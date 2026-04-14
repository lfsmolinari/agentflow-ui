import { describe, expect, it, vi } from 'vitest';
import { createCommandRunner } from '@infra/system/command-runner';

describe('createCommandRunner', () => {
  it('resolves with stdout and exitCode on success', async () => {
    const runner = createCommandRunner();
    const result = await runner.run('echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('calls onData with stdout chunks', async () => {
    const runner = createCommandRunner();
    const onData = vi.fn();

    await runner.run('echo', ['hello'], 15_000, onData);

    expect(onData).toHaveBeenCalled();
    const received = onData.mock.calls.map((c: [string]) => c[0]).join('');
    expect(received.trim()).toBe('hello');
  });

  it('rejects with timeout message when process exceeds timeoutMs', async () => {
    const runner = createCommandRunner();

    await expect(runner.run('sleep', ['10'], 100)).rejects.toThrow(/timed out after 100ms/);
  });

  it('rejects when child process emits error (command not found)', async () => {
    const runner = createCommandRunner();

    await expect(runner.run('__nonexistent_command_xyz__', [], 5_000)).rejects.toThrow();
  });
});
