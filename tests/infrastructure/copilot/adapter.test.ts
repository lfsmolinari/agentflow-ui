import { describe, expect, it, vi } from 'vitest';
import { CopilotCliAdapter, parseAuthStatus } from '@infra/copilot/adapter';
import type { CommandRunner } from '@infra/system/command-runner';

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

  it('throws when exitCode is non-zero and output has no recognisable pattern', () => {
    expect(() =>
      parseAuthStatus({
        exitCode: 1,
        stdout: 'unexpected error code 42',
        stderr: ''
      })
    ).toThrow();
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
});
