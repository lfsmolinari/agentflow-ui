import { describe, it, expect, vi } from 'vitest';
import { createInteractiveCommandRunner } from '@infra/system/interactive-command-runner';

describe('createInteractiveCommandRunner', () => {
  it('onData callback receives stdout from the child process', async () => {
    const received: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 5_000);
      createInteractiveCommandRunner(
        'echo',
        ['hello-from-runner'],
        process.cwd(),
        (chunk) => received.push(chunk),
        (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`unexpected exit code: ${code}`));
        }
      );
    });

    expect(received.join('')).toContain('hello-from-runner');
  });

  it('write() sends data to stdin and onData receives it back', async () => {
    const received: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 5_000);
      const runner = createInteractiveCommandRunner(
        'node',
        ['-e', 'process.stdin.on("data", d => { process.stdout.write(d.toString()); process.exit(0); })'],
        process.cwd(),
        (chunk) => received.push(chunk),
        (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`exit ${code}`));
        }
      );
      setTimeout(() => runner.write('stdin-test'), 50);
    });

    expect(received.join('')).toContain('stdin-test');
  });

  it('onExit fires with exit code 0 after process completes', async () => {
    const exitCode = await new Promise<number | null>((resolve) => {
      createInteractiveCommandRunner(
        'echo',
        ['done'],
        process.cwd(),
        () => {},
        resolve
      );
    });

    expect(exitCode).toBe(0);
  });

  it('close() terminates the running process', async () => {
    const onExit = vi.fn();
    const runner = createInteractiveCommandRunner(
      'node',
      ['-e', 'setInterval(() => {}, 1000)'],
      process.cwd(),
      () => {},
      onExit
    );

    runner.close();

    // Give the process a moment to exit after being killed
    await new Promise((r) => setTimeout(r, 500));
    expect(onExit).toHaveBeenCalled();
  });
});
