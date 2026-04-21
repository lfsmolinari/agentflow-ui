import { describe, expect, it } from 'vitest';
import { createInteractiveCommandRunner } from '@infra/system/interactive-command-runner';

describe('createInteractiveCommandRunner', () => {
  it('write() throws after process exits', async () => {
    const runner = createInteractiveCommandRunner(
      process.execPath,
      ['-e', 'process.exit(0)'],
      process.cwd(),
      () => {},
      () => {}
    );

    await new Promise<void>((resolve) => {
      const original = runner.pid;
      // Poll until the process is gone
      const interval = setInterval(() => {
        try {
          runner.write('probe');
        } catch {
          clearInterval(interval);
          resolve();
          return;
        }
        // If pid is falsy the process is definitely dead
        if (!original) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
      // Fallback: resolve after 2s so the test doesn't hang
      setTimeout(() => { clearInterval(interval); resolve(); }, 2000);
    });

    expect(() => runner.write('hello')).toThrow(
      'Cannot write to process: stdin is unavailable or process has exited'
    );
  });

  it('write() throws after close()', async () => {
    const runner = createInteractiveCommandRunner(
      process.execPath,
      ['-e', 'setTimeout(()=>{},99999)'],
      process.cwd(),
      () => {},
      () => {}
    );

    runner.close();

    // Wait briefly for the process to die
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(() => runner.write('hi')).toThrow(
      'Cannot write to process: stdin is unavailable or process has exited'
    );
  });
});
