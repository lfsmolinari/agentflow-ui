import { describe, expect, it, vi, afterEach } from 'vitest';
import { CopilotCliAdapter, parseAuthStatus } from '@infra/copilot/adapter';
import type { CommandRunner } from '@infra/system/command-runner';
import type { InteractiveCommandRunner } from '@infra/system/interactive-command-runner';
import * as nodeFs from 'node:fs/promises';
import * as nodeFsSync from 'node:fs';

// Automock node:fs/promises so vi.mocked(nodeFs.readdir) is controllable in T9.
// All methods default to vi.fn() returning undefined; _resolveSessionCwd's readFile
// call fails gracefully (caught → returns homedir()) for tests that don't need it.
vi.mock('node:fs/promises');
// Automock node:fs so vi.mocked(nodeFsSync.realpathSync) is controllable in T01.
vi.mock('node:fs');

const { mockSdkClient } = vi.hoisted(() => {
  const mockSdkClient = {
    listSessions: vi.fn().mockResolvedValue([]),
    stop: vi.fn().mockResolvedValue(undefined),
  };
  return { mockSdkClient };
});

vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: vi.fn(() => mockSdkClient),
}));

describe('parseAuthStatus', () => {
  it('parses an authenticated JSON payload', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: JSON.stringify({ authenticated: true }),
        stderr: ''
      })
    ).toEqual({ authenticated: true });
  });

  it('parses an unauthenticated text payload', () => {
    expect(
      parseAuthStatus({
        exitCode: 1,
        stdout: '',
        stderr: 'Not logged in. Run copilot login.'
      })
    ).toEqual({
      authenticated: false,
      reason: 'Copilot CLI reported an unauthenticated state.'
    });
  });

  it('returns authenticated for exitCode 0 with no output (optimistic auth assumption)', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: '',
        stderr: ''
      })
    ).toEqual({ authenticated: true });
  });

  it('treats unrecognised text with exitCode 0 as authenticated', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: 'status ok',
        stderr: ''
      })
    ).toEqual({ authenticated: true });
  });

  it('returns authenticated: true for JSON user/status response with exitCode 0', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: JSON.stringify({ user: 'lfsmolinari', status: 'ok' }),
        stderr: ''
      })
    ).toEqual({ authenticated: true });
  });

  it('returns authenticated: false for JSON with error field', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: JSON.stringify({ error: 'not logged in' }),
        stderr: ''
      })
    ).toEqual({
      authenticated: false,
      reason: 'Copilot CLI reported an unauthenticated state.'
    });
  });

  it('returns authenticated: false for JSON with status: unauthenticated', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: JSON.stringify({ status: 'unauthenticated' }),
        stderr: ''
      })
    ).toEqual({
      authenticated: false,
      reason: 'Copilot CLI reported an unauthenticated state.'
    });
  });

  it('returns authenticated: false for non-zero exit with unrecognised output (does not throw)', () => {
    expect(
      parseAuthStatus({
        exitCode: 1,
        stdout: 'unexpected error code 42',
        stderr: ''
      })
    ).toEqual({
      authenticated: false,
      reason: 'Copilot CLI reported an unauthenticated state.'
    });
  });

  it('parses a JSON payload with authenticated: false as unauthenticated', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: JSON.stringify({ authenticated: false }),
        stderr: ''
      })
    ).toEqual({
      authenticated: false,
      reason: 'Copilot CLI reported an unauthenticated state.'
    });
  });

  it('returns authenticated when exitCode is 0 and stdout matches the authenticated pattern', () => {
    expect(
      parseAuthStatus({
        exitCode: 0,
        stdout: 'Logged in as octocat',
        stderr: ''
      })
    ).toEqual({ authenticated: true });
  });
});

describe('CopilotCliAdapter', () => {
  it('invokes enterprise login with the host argument', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = {
      run: async (command, args = []) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      }
    };

    const adapter = new CopilotCliAdapter(runner);
    await adapter.loginWithEnterprise('enterprise.example.com');

    expect(calls[0]).toEqual({
      command: 'copilot',
      args: ['login', '--host', 'enterprise.example.com']
    });
  });

  it('loginWithGitHub rejects when the command runner returns exitCode: 1', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: 'some cli output', stderr: '' })
    };

    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.loginWithGitHub()).rejects.toThrow();
  });

  it('loginWithEnterprise rejects when the command runner returns exitCode: 1', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: 'some cli output', stderr: '' })
    };

    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.loginWithEnterprise('github.example.com')).rejects.toThrow();
  });

  it('isInstalled returns true when copilot --version exits 0 with version output', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'copilot version 1.0.0', stderr: '' })
    };

    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.isInstalled()).resolves.toBe(true);
  });

  it('isInstalled returns false when copilot --version exits non-zero', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' })
    };

    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.isInstalled()).resolves.toBe(false);
  });

  it('isInstalled returns false when VS Code shim is detected', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'Cannot find GitHub Copilot CLI', stderr: '' })
    };

    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.isInstalled()).resolves.toBe(false);
  });

  it('loginWithGitHub forwards onData chunks to the runner', async () => {
    const mockRunner: CommandRunner = {
      run: async (_cmd, _args, _timeout, onData) => {
        onData?.('code-chunk');
        return { exitCode: 0, stdout: '', stderr: '' };
      }
    };

    const adapter = new CopilotCliAdapter(mockRunner);
    const spy = vi.fn();
    await adapter.loginWithGitHub(spy);

    expect(spy).toHaveBeenCalledWith('code-chunk');
  });

  it('loginWithEnterprise forwards onData chunks to the runner', async () => {
    const mockRunner: CommandRunner = {
      run: async (_cmd, _args, _timeout, onData) => {
        onData?.('code-chunk');
        return { exitCode: 0, stdout: '', stderr: '' };
      }
    };

    const adapter = new CopilotCliAdapter(mockRunner);
    const spy = vi.fn();
    await adapter.loginWithEnterprise('github.example.com', spy);

    expect(spy).toHaveBeenCalledWith('code-chunk');
  });

  it('isInstalled returns false when the runner throws', async () => {
    const runner: CommandRunner = {
      run: async () => { throw new Error('spawn ENOENT'); }
    };
    const adapter = new CopilotCliAdapter(runner);
    await expect(adapter.isInstalled()).resolves.toBe(false);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const noopCommandRunner: CommandRunner = {
  run: async () => ({ exitCode: 0, stdout: '', stderr: '' })
};

function injectEntry(adapter: CopilotCliAdapter, sessionId: string, entry: unknown): void {
  (adapter as unknown as { activeSessions: Map<string, unknown> }).activeSessions.set(sessionId, entry);
}

/**
 * Seeds an adapter with a pre-built session entry and exposes triggerData/triggerExit
 * so tests can simulate stdout/exit without going through a real runner factory.
 * The routing function mirrors what startNewSession builds internally.
 */
function makeSeededAdapter(sessionId = 'test-session') {
  const adapter = new CopilotCliAdapter(noopCommandRunner);
  const adapterAny = adapter as unknown as { hasPrompt(b: string): boolean };
  const write = vi.fn();
  // entry is a plain mutable object; sendMessage mutates entry.responseState directly
  const entry = {
    runner: { write, close: vi.fn(), get pid() { return 1; } },
    workspacePath: '/tmp',
    isReady: true,
    pendingReady: [] as Array<() => void>,
    responseState: null as null | {
      buffer: string; hasContent: boolean;
      idleTimer: ReturnType<typeof setTimeout> | undefined;
      maxTimer: ReturnType<typeof setTimeout> | undefined;
      onData(c: string): void; settle(): void; reject(e: Error): void;
    }
  };
  injectEntry(adapter, sessionId, entry);

  // Replicates the onData router that startNewSession installs on the runner
  const triggerData = (chunk: string): void => {
    if (entry.responseState !== null) {
      const rs = entry.responseState;
      rs.buffer += chunk;
      if (chunk.length > 0) rs.hasContent = true;
      rs.onData(chunk);
      if (adapterAny.hasPrompt(rs.buffer)) {
        rs.settle();
      } else if (rs.hasContent) {
        clearTimeout(rs.idleTimer);
        rs.idleTimer = setTimeout(rs.settle, 5_000);
      }
    }
  };

  const triggerExit = (code: number | null): void => {
    if (entry.responseState !== null) {
      const rs = entry.responseState;
      clearTimeout(rs.idleTimer);
      clearTimeout(rs.maxTimer);
      entry.responseState = null;
      rs.reject(new Error(`copilot process exited unexpectedly (code ${code})`));
    }
    (adapter as unknown as { activeSessions: Map<string, unknown> }).activeSessions.delete(sessionId);
  };

  return { adapter, sessionId, triggerData, triggerExit, write };
}

function makeRunnerFactory(): {
  factory: typeof import('@infra/system/interactive-command-runner').createInteractiveCommandRunner;
  lastClose: ReturnType<typeof vi.fn>;
} {
  let lastClose = vi.fn();

  const factory = vi.fn().mockImplementation(
    (_cmd: string, _args: string[], _cwd: string,
      onData: (c: string) => void
    ): InteractiveCommandRunner => {
      lastClose = vi.fn();
      Promise.resolve().then(() => onData('> '));
      return {
        write: vi.fn(),
        close: lastClose,
        get pid() { return 12345; }
      };
    }
  ) as unknown as typeof import('@infra/system/interactive-command-runner').createInteractiveCommandRunner;

  return {
    factory,
    get lastClose() { return lastClose; }
  };
}

// ── T8: stripAnsi + hasPrompt ─────────────────────────────────────────────────

describe('CopilotCliAdapter private helpers', () => {
  it('stripAnsi removes ANSI escape codes', () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    const strip = (t: string): string =>
      (adapter as unknown as { stripAnsi(s: string): string }).stripAnsi(t);
    expect(strip('hello \x1b[32mworld\x1b[0m')).toBe('hello world');
    expect(strip('\x1b[2J\x1b[H')).toBe('');
    expect(strip('plain text')).toBe('plain text');
  });

  it('hasPrompt detects > and ? prompt characters at end of buffer', () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    const hp = (b: string): boolean =>
      (adapter as unknown as { hasPrompt(s: string): boolean }).hasPrompt(b);
    expect(hp('some text\n> ')).toBe(true);
    expect(hp('some text\n? ')).toBe(true);
    expect(hp('> ')).toBe(true);
    // > not at end of last line should not match
    expect(hp('> text continues after prompt')).toBe(false);
    expect(hp('')).toBe(false);
    // ANSI-wrapped prompt should still match after stripping
    expect(hp('\x1b[32m> \x1b[0m')).toBe(true);
  });
});

// ── T9: startNewSession keeps process alive ───────────────────────────────────

describe('CopilotCliAdapter.startNewSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves with a Session, stores runner in activeSessions, does NOT close the runner', async () => {
    // First call (before list): empty. Second call (first poll): new dir appeared.
    vi.mocked(nodeFs.readdir)
      .mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof nodeFs.readdir>>)
      .mockResolvedValueOnce(['test-session-abc'] as unknown as Awaited<ReturnType<typeof nodeFs.readdir>>);

    const factoryCtx = makeRunnerFactory();
    const adapter = new CopilotCliAdapter(noopCommandRunner, factoryCtx.factory);

    const session = await adapter.startNewSession('/tmp/workspace');

    expect(session.id).toBe('test-session-abc');
    expect(session.workspacePath).toBe('/tmp/workspace');
    // Runner must NOT be closed during startNewSession — process stays alive
    expect(factoryCtx.lastClose).not.toHaveBeenCalled();

    // Verify it's in activeSessions: closeSession should call runner.close
    adapter.closeSession('test-session-abc');
    expect(factoryCtx.lastClose).toHaveBeenCalledOnce();
  });
});

// ── T10: sendMessage ──────────────────────────────────────────────────────────

describe('CopilotCliAdapter.sendMessage', () => {
  it('prompt detection settles the response', async () => {
    const { adapter, sessionId, triggerData } = makeSeededAdapter();
    const chunks: string[] = [];

    // For pre-seeded sessions sendMessage reaches responseState setup synchronously
    const p = adapter.sendMessage(sessionId, 'hello', (c) => chunks.push(c));

    triggerData('Hello there');
    triggerData('\n> '); // prompt → settle

    await p;
    expect(chunks).toContain('Hello there');
  });

  it('idle timer fires when no prompt is detected', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, sessionId, triggerData } = makeSeededAdapter();

      let resolved = false;
      const p = adapter.sendMessage(sessionId, 'hello', () => { /* noop */ })
        .then(() => { resolved = true; });

      triggerData('Thinking...'); // starts idle timer, no prompt

      expect(resolved).toBe(false);

      // Advance past IDLE_TIMEOUT_MS (5_000 ms)
      await vi.advanceTimersByTimeAsync(5_100);

      await p;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dead process rejects in-flight message', async () => {
    const { adapter, sessionId, triggerExit } = makeSeededAdapter();

    const p = adapter.sendMessage(sessionId, 'hello', () => { /* noop */ });

    triggerExit(1); // onExit fires → reject

    await expect(p).rejects.toThrow(/exited unexpectedly/);
  });

  it('busy guard rejects immediately when session has an in-flight message', async () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    const fakeEntry = {
      runner: { write: vi.fn(), close: vi.fn(), get pid() { return 1; } },
      workspacePath: '/tmp',
      isReady: true,
      pendingReady: [],
      responseState: {
        onData: vi.fn(), resolve: vi.fn(), reject: vi.fn(), settle: vi.fn(),
        idleTimer: undefined, maxTimer: undefined, buffer: '', hasContent: false
      }
    };
    injectEntry(adapter, 'sid-busy', fakeEntry);

    await expect(
      adapter.sendMessage('sid-busy', 'hi', () => { /* noop */ })
    ).rejects.toThrow(/busy/);
  });

  it('lazy resume: spawns via --resume when session not in map', async () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);

    let capturedOnData: ((chunk: string) => void) | undefined;
    let factoryCalledResolve!: () => void;
    const factoryCalledPromise = new Promise<void>(r => { factoryCalledResolve = r; });

    const lazyFactory = vi.fn().mockImplementationOnce(
      (_cmd: string, args: string[], _cwd: string,
        onData: (c: string) => void
      ): InteractiveCommandRunner => {
        expect(args).toContain('--resume');
        capturedOnData = onData;
        factoryCalledResolve();
        // Emit ready prompt via microtask
        Promise.resolve().then(() => onData('> '));
        return { write: vi.fn(), close: vi.fn(), get pid() { return 1; } };
      }
    ) as unknown as typeof import('@infra/system/interactive-command-runner').createInteractiveCommandRunner;

    // Replace runnerFactory on the adapter instance
    (adapter as unknown as { runnerFactory: unknown }).runnerFactory = lazyFactory;

    const chunks: string[] = [];
    const p = adapter.sendMessage('resume-id', 'hi', (c) => chunks.push(c));

    // Wait for factory to be called (includes async _resolveSessionCwd I/O)
    await factoryCalledPromise;
    // Flush microtasks: ready prompt emission + waitForReady resolution
    for (let i = 0; i < 8; i++) await Promise.resolve();
    // Allow POST_READY_DELAY_MS (50ms) to elapse, then flush the continuation
    await new Promise(r => setTimeout(r, 55));
    for (let i = 0; i < 4; i++) await Promise.resolve();

    expect(capturedOnData).toBeDefined();
    capturedOnData!('Response content');
    capturedOnData!('\n> ');

    await p;
    expect(chunks).toContain('Response content');
  });
});

// ── T11: closeSession + closeAll ──────────────────────────────────────────────

describe('CopilotCliAdapter.closeSession and closeAll', () => {
  it('closeSession calls runner.close() and removes from activeSessions', () => {
    const mockClose = vi.fn();
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    injectEntry(adapter, 'sess-1', {
      runner: { write: vi.fn(), close: mockClose, get pid() { return 1; } },
      workspacePath: '/tmp', isReady: true, pendingReady: [], responseState: null
    });

    adapter.closeSession('sess-1');

    expect(mockClose).toHaveBeenCalledOnce();
    const map = (adapter as unknown as { activeSessions: Map<string, unknown> }).activeSessions;
    expect(map.has('sess-1')).toBe(false);
  });

  it('closeSession with unknown ID is a no-op', () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    expect(() => adapter.closeSession('nonexistent')).not.toThrow();
  });

  it('closeAll terminates all active runners and empties the map', () => {
    const close1 = vi.fn();
    const close2 = vi.fn();
    const adapter = new CopilotCliAdapter(noopCommandRunner);

    injectEntry(adapter, 'a', {
      runner: { write: vi.fn(), close: close1, get pid() { return 1; } },
      workspacePath: '/a', isReady: true, pendingReady: [], responseState: null
    });
    injectEntry(adapter, 'b', {
      runner: { write: vi.fn(), close: close2, get pid() { return 2; } },
      workspacePath: '/b', isReady: true, pendingReady: [], responseState: null
    });

    adapter.closeAll();

    expect(close1).toHaveBeenCalledOnce();
    expect(close2).toHaveBeenCalledOnce();
    const map = (adapter as unknown as { activeSessions: Map<string, unknown> }).activeSessions;
    expect(map.size).toBe(0);
  });
});

// ── T01: listSessions path normalization ──────────────────────────────────────

describe('listSessions path normalization', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('matches a session when e.cwd is a symlink path that resolves to workspacePath', async () => {
    vi.mocked(nodeFsSync.realpathSync as unknown as (p: string) => string)
      .mockImplementation((p: string) => {
        if (p === '/symlink/path') return '/real/path';
        return p;
      });

    vi.mocked(nodeFs.readdir).mockResolvedValueOnce(
      [{ isDirectory: () => true, name: 'session-1' }] as unknown as Awaited<ReturnType<typeof nodeFs.readdir>>
    );
    vi.mocked(nodeFs.readFile).mockResolvedValueOnce(
      '{"cwd":"/symlink/path","timestamp":1000}\n' as unknown as Awaited<ReturnType<typeof nodeFs.readFile>>
    );

    const adapter = new CopilotCliAdapter(noopCommandRunner);
    const sessions = await adapter.listSessions('/real/path');
    expect(sessions).toHaveLength(1);
    // workspacePath in the returned session is the original argument, not normalized
    expect(sessions[0].workspacePath).toBe('/real/path');
  });

  it('excludes a session when e.cwd resolves to a different real path', async () => {
    vi.mocked(nodeFsSync.realpathSync as unknown as (p: string) => string)
      .mockImplementation((p: string) => {
        if (p === '/other/workspace') return '/other/path';
        return p;
      });

    vi.mocked(nodeFs.readdir).mockResolvedValueOnce(
      [{ isDirectory: () => true, name: 'session-2' }] as unknown as Awaited<ReturnType<typeof nodeFs.readdir>>
    );
    vi.mocked(nodeFs.readFile).mockResolvedValueOnce(
      '{"cwd":"/other/workspace","timestamp":1000}\n' as unknown as Awaited<ReturnType<typeof nodeFs.readFile>>
    );

    const adapter = new CopilotCliAdapter(noopCommandRunner);
    const sessions = await adapter.listSessions('/real/path');
    expect(sessions).toHaveLength(0);
  });

  it('does not throw when realpathSync throws (falls back to path.resolve)', async () => {
    vi.mocked(nodeFsSync.realpathSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    vi.mocked(nodeFs.readdir).mockResolvedValueOnce(
      [{ isDirectory: () => true, name: 'session-3' }] as unknown as Awaited<ReturnType<typeof nodeFs.readdir>>
    );
    vi.mocked(nodeFs.readFile).mockResolvedValueOnce(
      '{"cwd":"/same/path","timestamp":1000}\n' as unknown as Awaited<ReturnType<typeof nodeFs.readFile>>
    );

    const adapter = new CopilotCliAdapter(noopCommandRunner);
    await expect(adapter.listSessions('/same/path')).resolves.toBeDefined();
  });
});

// ── T02: hasPrompt — long-prefix detection ────────────────────────────────────

describe('hasPrompt long-prefix detection', () => {
  const adapter = new CopilotCliAdapter(noopCommandRunner);
  const hp = (b: string): boolean =>
    (adapter as unknown as { hasPrompt(s: string): boolean }).hasPrompt(b);

  it('returns true for a 150-char prefix on the previous line followed by a prompt', () => {
    const input =
      'Starting GitHub Copilot Strategist agent session for workspace at /Users/dev/my-very-long-project-name with session context...\n> ';
    expect(hp(input)).toBe(true);
  });

  it('returns true for a minimal prompt string', () => {
    expect(hp('> ')).toBe(true);
  });

  it('returns false for a string ending mid-sentence with no prompt character', () => {
    expect(hp('Thinking about your question and preparing a response')).toBe(false);
  });
});

// ── T03: write() error propagation ────────────────────────────────────────────

describe('sendMessage write() error propagation', () => {
  it('rejects with the write error when runner.write throws', async () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    injectEntry(adapter, 'dead-session', {
      runner: {
        write: vi.fn(() => { throw new Error('dead stdin'); }),
        close: vi.fn(),
        get pid() { return 1; }
      },
      workspacePath: '/tmp',
      isReady: true,
      pendingReady: [],
      responseState: null
    });

    await expect(
      adapter.sendMessage('dead-session', 'hi', () => { /* noop */ })
    ).rejects.toThrow(/dead stdin/);
  });

  it('does not leave session in busy state after write() throws', async () => {
    const adapter = new CopilotCliAdapter(noopCommandRunner);
    injectEntry(adapter, 'dead-session-2', {
      runner: {
        write: vi.fn(() => { throw new Error('dead stdin'); }),
        close: vi.fn(),
        get pid() { return 1; }
      },
      workspacePath: '/tmp',
      isReady: true,
      pendingReady: [],
      responseState: null
    });

    // First call rejects with write error
    await expect(
      adapter.sendMessage('dead-session-2', 'first', () => { /* noop */ })
    ).rejects.toThrow(/dead stdin/);

    // Second call also rejects with write error — NOT with "busy" — responseState was reset
    await expect(
      adapter.sendMessage('dead-session-2', 'second', () => { /* noop */ })
    ).rejects.toThrow(/dead stdin/);
  });
});

// ── T04: post-ready delay in lazy-init ────────────────────────────────────────

describe('sendMessage lazy-init post-ready delay', () => {
  it('does not call write() until POST_READY_DELAY_MS elapses after waitForReady resolves', async () => {
    vi.useFakeTimers();
    try {
      const adapter = new CopilotCliAdapter(noopCommandRunner);
      const mockWrite = vi.fn();
      let capturedOnData: ((c: string) => void) | undefined;
      let factoryCalledResolve!: () => void;
      const factoryCalledPromise = new Promise<void>(r => { factoryCalledResolve = r; });

      const lazyFactory = vi.fn().mockImplementationOnce(
        (_cmd: string, _args: string[], _cwd: string,
          onData: (c: string) => void
        ): InteractiveCommandRunner => {
          capturedOnData = onData;
          factoryCalledResolve();
          // Emit ready prompt via microtask (not timer)
          Promise.resolve().then(() => onData('> '));
          return { write: mockWrite, close: vi.fn(), get pid() { return 1; } };
        }
      ) as unknown as typeof import('@infra/system/interactive-command-runner').createInteractiveCommandRunner;

      (adapter as unknown as { runnerFactory: unknown }).runnerFactory = lazyFactory;

      const p = adapter.sendMessage('lazy-delay-session', 'hello', () => { /* noop */ });

      // Wait for factory to be called (covers async _resolveSessionCwd)
      await factoryCalledPromise;
      // Flush microtasks: ready prompt emission + waitForReady resolution
      for (let i = 0; i < 8; i++) await Promise.resolve();

      // write() must NOT have been called yet — still inside POST_READY_DELAY_MS window
      expect(mockWrite).not.toHaveBeenCalled();

      // Advance past POST_READY_DELAY_MS (50ms)
      await vi.advanceTimersByTimeAsync(55);

      expect(mockWrite).toHaveBeenCalledWith('hello');

      // Settle the in-flight response to avoid dangling timers
      capturedOnData!('\n> ');
      await p;
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── probeAuthState ────────────────────────────────────────────────────────────

describe('CopilotCliAdapter.probeAuthState', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated: true when CopilotClient.listSessions resolves', async () => {
    mockSdkClient.listSessions.mockResolvedValue([]);
    const adapter = new CopilotCliAdapter();
    const result = await adapter.probeAuthState();
    expect(result).toEqual({ authenticated: true });
  });

  it('returns authenticated: false when CopilotClient.listSessions rejects', async () => {
    mockSdkClient.listSessions.mockRejectedValue(new Error('not authenticated'));
    const adapter = new CopilotCliAdapter();
    const result = await adapter.probeAuthState();
    expect(result).toEqual({
      authenticated: false,
      reason: 'Copilot CLI is not authenticated. Please run copilot login.',
    });
  });
});

