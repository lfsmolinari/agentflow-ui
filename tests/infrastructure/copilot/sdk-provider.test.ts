import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as nodeFs from 'node:fs/promises';
import * as nodeFsSync from 'node:fs';

// Hoist shared mock objects so they are accessible both in the vi.mock factory and in test helpers
const { mockSession, mockClient } = vi.hoisted(() => {
  const mockSession = {
    sessionId: 'test-session-id',
    on: vi.fn(() => vi.fn()), // returns an unsub function
    sendAndWait: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    createSession: vi.fn().mockResolvedValue(mockSession),
    resumeSession: vi.fn().mockResolvedValue(mockSession),
    listSessions: vi.fn().mockResolvedValue([]),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  return { mockSession, mockClient };
});

// Mock the SDK module before importing the provider
vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: vi.fn(() => mockClient),
  approveAll: vi.fn(),
}));

vi.mock('node:fs/promises');
vi.mock('node:fs');

import { CopilotSdkProvider } from '@infra/copilot/sdk-provider';

function getMockClient() {
  return mockClient as {
    createSession: ReturnType<typeof vi.fn>;
    resumeSession: ReturnType<typeof vi.fn>;
    listSessions: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
}

function getMockSession() {
  return mockSession as {
    sessionId: string;
    on: ReturnType<typeof vi.fn>;
    sendAndWait: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
}

describe('CopilotSdkProvider', () => {
  let provider: CopilotSdkProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodeFsSync.realpathSync).mockImplementation((p) => String(p));
    provider = new CopilotSdkProvider();
  });

  // ── startNewSession ───────────────────────────────────────────────────────

  describe('startNewSession', () => {
    it('calls createSession with streaming: true and systemMessage containing workspacePath', async () => {
      vi.mocked(nodeFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(nodeFs.writeFile).mockResolvedValue(undefined);

      const session = await provider.startNewSession('/my/workspace');

      const client = getMockClient();
      expect(client.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          streaming: true,
          systemMessage: expect.objectContaining({
            mode: 'replace',
            content: expect.stringContaining('/my/workspace'),
          }),
        })
      );
      expect(session.id).toBe('test-session-id');
      expect(session.workspacePath).toBe('/my/workspace');
      expect(session.createdAt).toBeDefined();
    });

    it('writes a sidecar file after session creation', async () => {
      vi.mocked(nodeFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(nodeFs.writeFile).mockResolvedValue(undefined);

      await provider.startNewSession('/my/workspace');

      expect(nodeFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-session-id'),
        expect.stringContaining('/my/workspace'),
        'utf-8'
      );
    });

    it('does not throw if sidecar write fails', async () => {
      vi.mocked(nodeFs.mkdir).mockRejectedValue(new Error('disk full'));

      await expect(provider.startNewSession('/my/workspace')).resolves.toBeDefined();
    });
  });

  // ── listSessions ─────────────────────────────────────────────────────────

  describe('listSessions', () => {
    it('returns sessions matching the workspace path from sidecar', async () => {
      const client = getMockClient();
      client.listSessions.mockResolvedValue([
        { sessionId: 'sess-1', startTime: '2026-01-01T00:00:00Z', modifiedTime: '2026-01-01T00:00:00Z' },
        { sessionId: 'sess-2', startTime: '2026-01-02T00:00:00Z', modifiedTime: '2026-01-02T00:00:00Z' },
      ]);

      vi.mocked(nodeFs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ workspacePath: '/my/workspace', createdAt: '2026-01-01T00:00:00Z' }))
        .mockRejectedValueOnce(new Error('no sidecar'));

      const sessions = await provider.listSessions('/my/workspace');

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('sess-1');
    });

    it('returns empty array when no sessions match the workspace', async () => {
      const client = getMockClient();
      client.listSessions.mockResolvedValue([
        { sessionId: 'sess-1', startTime: '2026-01-01T00:00:00Z', modifiedTime: '2026-01-01T00:00:00Z' },
      ]);
      vi.mocked(nodeFs.readFile).mockResolvedValue(
        JSON.stringify({ workspacePath: '/other/path', createdAt: '2026-01-01T00:00:00Z' })
      );

      const sessions = await provider.listSessions('/my/workspace');
      expect(sessions).toEqual([]);
    });

    it('returns empty array when listSessions throws', async () => {
      const client = getMockClient();
      client.listSessions.mockRejectedValue(new Error('SDK error'));

      const sessions = await provider.listSessions('/my/workspace');
      expect(sessions).toEqual([]);
    });
  });

  // ── openSession ───────────────────────────────────────────────────────────

  describe('openSession', () => {
    it('resumes session and maps user/assistant messages', async () => {
      const client = getMockClient();
      const resumedSession = {
        sessionId: 'sess-1',
        on: vi.fn(() => vi.fn()),
        sendAndWait: vi.fn(),
        getMessages: vi.fn().mockResolvedValue([
          { type: 'user.message', content: 'hello' },
          { type: 'assistant.message', content: 'hi there' },
          { type: 'some.other.event', content: 'ignored' },
        ]),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };
      client.resumeSession.mockResolvedValue(resumedSession);

      const messages = await provider.openSession('sess-1');

      expect(client.resumeSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({}));
      expect(messages).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ]);
    });

    it('returns empty array when resumeSession throws', async () => {
      const client = getMockClient();
      client.resumeSession.mockRejectedValue(new Error('not found'));

      const messages = await provider.openSession('missing-session');
      expect(messages).toEqual([]);
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('calls sendAndWait and delivers delta chunks via onData', async () => {
      vi.mocked(nodeFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(nodeFs.writeFile).mockResolvedValue(undefined);
      await provider.startNewSession('/ws');

      const mockSession = getMockSession();
      let deltaHandler: ((e: { data: { deltaContent: string } }) => void) | null = null;
      mockSession.on.mockImplementation((_event: string, handler: (e: { data: { deltaContent: string } }) => void) => {
        deltaHandler = handler;
        return vi.fn();
      });
      mockSession.sendAndWait.mockImplementation(async () => {
        deltaHandler?.({ data: { deltaContent: 'hello ' } });
        deltaHandler?.({ data: { deltaContent: 'world' } });
      });

      const chunks: string[] = [];
      await provider.sendMessage('test-session-id', 'hi', (chunk) => chunks.push(chunk));

      expect(chunks).toEqual(['hello ', 'world']);
      expect(mockSession.sendAndWait).toHaveBeenCalledWith({ prompt: 'hi' }, 120_000);
    });

    it('unsubscribes from delta events in finally block', async () => {
      vi.mocked(nodeFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(nodeFs.writeFile).mockResolvedValue(undefined);
      await provider.startNewSession('/ws');

      const mockSession = getMockSession();
      const unsub = vi.fn();
      mockSession.on.mockReturnValue(unsub);
      mockSession.sendAndWait.mockRejectedValue(new Error('network error'));

      await expect(provider.sendMessage('test-session-id', 'hi', vi.fn())).rejects.toThrow('network error');
      expect(unsub).toHaveBeenCalled();
    });

    it('lazy-resumes session if not in activeSessions', async () => {
      const client = getMockClient();
      const resumedSession = {
        sessionId: 'lazy-session',
        on: vi.fn(() => vi.fn()),
        sendAndWait: vi.fn().mockResolvedValue(undefined),
        getMessages: vi.fn().mockResolvedValue([]),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };
      client.resumeSession.mockResolvedValue(resumedSession);

      await provider.sendMessage('lazy-session', 'text', vi.fn());

      expect(client.resumeSession).toHaveBeenCalledWith('lazy-session', expect.objectContaining({}));
    });
  });

  // ── closeSession ──────────────────────────────────────────────────────────

  describe('closeSession', () => {
    it('disconnects the session and removes it from active sessions', async () => {
      vi.mocked(nodeFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(nodeFs.writeFile).mockResolvedValue(undefined);
      await provider.startNewSession('/ws');

      const mockSession = getMockSession();
      provider.closeSession('test-session-id');

      expect(mockSession.disconnect).toHaveBeenCalled();
    });

    it('is a no-op for unknown session IDs', () => {
      expect(() => provider.closeSession('unknown-id')).not.toThrow();
    });
  });

  // ── closeAll ──────────────────────────────────────────────────────────────

  describe('closeAll', () => {
    it('calls client.stop()', async () => {
      // Initialize the client by calling a method that uses this.client
      getMockClient().listSessions.mockResolvedValue([]);
      await provider.listSessions('/workspace');

      provider.closeAll();
      expect(getMockClient().stop).toHaveBeenCalled();
    });
  });
});
