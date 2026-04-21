import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dirent } from 'node:fs';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: () => '/home/testuser',
}));

import * as fsPromises from 'node:fs/promises';
import { CopilotCliAdapter } from '@infra/copilot/adapter';

// Inline JSONL fixture: session with cwd match, a rename event, and chat messages
const SESSION_JSONL_WITH_RENAME = [
  '{"sessionId":"abc123","timestamp":1700000000000,"cwd":"/home/user/project","source":"new"}',
  '{"type":"rename","name":"My Session","timestamp":1700000001000}',
  '{"type":"userMessage","content":"Hello Strategist","timestamp":1700000002000}',
  '{"type":"assistantMessage","content":"Hello! How can I help?","timestamp":1700000003000}',
].join('\n');

const SESSION_JSONL_NO_RENAME = [
  '{"sessionId":"abc123","timestamp":1700000000000,"cwd":"/home/user/project","source":"new"}',
  '{"type":"userMessage","content":"Hello","timestamp":1700000002000}',
].join('\n');

const makeDirEntry = (name: string): Dirent =>
  ({ name, isDirectory: () => true, isFile: () => false } as unknown as Dirent);

describe('CopilotCliAdapter.listSessions', () => {
  let adapter: CopilotCliAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure COPILOT_HOME env var does not override the os.homedir() mock
    delete process.env.COPILOT_HOME;
    adapter = new CopilotCliAdapter();
  });

  it('returns [] when the sessions directory does not exist', async () => {
    vi.mocked(fsPromises.readdir).mockRejectedValue(
      Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }),
    );
    expect(await adapter.listSessions('/home/user/project')).toEqual([]);
  });

  it('returns [] when the directory exists but no session matches the workspace path', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([makeDirEntry('sess-1')] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    vi.mocked(fsPromises.readFile).mockResolvedValue(
      '{"sessionId":"sess-1","timestamp":1700000000000,"cwd":"/other/path","source":"new"}' as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>,
    );
    expect(await adapter.listSessions('/home/user/project')).toEqual([]);
  });

  it('returns Session[] with correct fields when a session with matching cwd exists', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([makeDirEntry('abc123')] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    vi.mocked(fsPromises.readFile).mockResolvedValue(SESSION_JSONL_WITH_RENAME as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const sessions = await adapter.listSessions('/home/user/project');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'abc123',
      workspacePath: '/home/user/project',
    });
    expect(sessions[0].createdAt).toBeDefined();
  });

  it('derives title from a rename event when present', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([makeDirEntry('abc123')] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    vi.mocked(fsPromises.readFile).mockResolvedValue(SESSION_JSONL_WITH_RENAME as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const sessions = await adapter.listSessions('/home/user/project');

    expect(sessions[0].title).toBe('My Session');
  });

  it('falls back to formatted timestamp as title when no rename event exists', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([makeDirEntry('abc123')] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    vi.mocked(fsPromises.readFile).mockResolvedValue(SESSION_JSONL_NO_RENAME as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const sessions = await adapter.listSessions('/home/user/project');

    expect(sessions[0].title).toBe(new Date(1700000000000).toLocaleString());
  });

  it('returns [] (does not throw) when a session events.jsonl is unreadable', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([makeDirEntry('abc123')] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Permission denied'));

    await expect(adapter.listSessions('/home/user/project')).resolves.toEqual([]);
  });

  it('returns sessions sorted by createdAt descending (most recent first)', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValue([
      makeDirEntry('sess-1'),
      makeDirEntry('sess-2'),
    ] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);
    // sess-1 has an earlier timestamp; sess-2 has a later timestamp
    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(
        '{"sessionId":"sess-1","timestamp":1700000000000,"cwd":"/home/user/project","source":"new"}' as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>,
      )
      .mockResolvedValueOnce(
        '{"sessionId":"sess-2","timestamp":1700001000000,"cwd":"/home/user/project","source":"new"}' as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>,
      );

    const sessions = await adapter.listSessions('/home/user/project');

    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('sess-2'); // more recent first
    expect(sessions[1].id).toBe('sess-1');
  });
});

// Events JSONL fixture for openSession tests
const OPEN_SESSION_JSONL = [
  '{"sessionId":"abc123","timestamp":1700000000000,"cwd":"/home/user/project","source":"new"}',
  '{"type":"userMessage","content":"Hello Strategist"}',
  '{"type":"assistantMessage","content":"Hello! How can I help?"}',
  '{"type":"userMessage","content":"Tell me something"}',
  '{"type":"assistantMessage","content":"Sure!"}',
].join('\n');

describe('CopilotCliAdapter.openSession', () => {
  let adapter: CopilotCliAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COPILOT_HOME;
    adapter = new CopilotCliAdapter();
  });

  it('returns ChatMessage[] in correct order for userMessage and assistantMessage events', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(OPEN_SESSION_JSONL as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const messages = await adapter.openSession('abc123');

    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello Strategist' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hello! How can I help?' });
    expect(messages[2]).toEqual({ role: 'user', content: 'Tell me something' });
    expect(messages[3]).toEqual({ role: 'assistant', content: 'Sure!' });
  });

  it('returns [] when the events file is empty', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('' as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const messages = await adapter.openSession('abc123');

    expect(messages).toEqual([]);
  });

  it('returns [] when the events file contains only startup events (no chat messages)', async () => {
    const startupOnly =
      '{"sessionId":"abc123","timestamp":1700000000000,"cwd":"/home/user/project","source":"new"}';
    vi.mocked(fsPromises.readFile).mockResolvedValue(startupOnly as unknown as Awaited<ReturnType<typeof fsPromises.readFile>>);

    const messages = await adapter.openSession('abc123');

    expect(messages).toEqual([]);
  });

  it('returns [] (does not throw) when the events file cannot be read', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT'));

    await expect(adapter.openSession('abc123')).resolves.toEqual([]);
  });

  it('throws for a path-traversal session ID', async () => {
    await expect(adapter.openSession('../../etc/passwd')).rejects.toThrow('Invalid session ID');
  });
});
