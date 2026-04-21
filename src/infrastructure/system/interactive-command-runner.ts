import { spawn, ChildProcess } from 'node:child_process';

export interface InteractiveCommandRunner {
  write(text: string): void;
  close(): void;
  readonly pid: number | undefined;
}

export function createInteractiveCommandRunner(
  command: string,
  args: string[],
  cwd: string,
  onData: (chunk: string) => void,
  onExit: (code: number | null) => void
): InteractiveCommandRunner {
  const child: ChildProcess = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  child.stdout?.on('data', (data: Buffer) => {
    try {
      onData(data.toString('utf-8'));
    } catch (err) {
      console.error('[InteractiveCommandRunner] onData threw (stdout):', err);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    try {
      onData(data.toString('utf-8'));
    } catch (err) {
      console.error('[InteractiveCommandRunner] onData threw (stderr):', err);
    }
  });

  child.on('exit', (code) => {
    try {
      onExit(code);
    } catch (err) {
      console.error('[InteractiveCommandRunner] onExit threw:', err);
    }
  });

  child.on('error', (err) => {
    try {
      onData(`[Process error: ${err.message}]`);
      onExit(-1);
    } catch (callbackErr) {
      console.error('[InteractiveCommandRunner] onData/onExit threw in error handler:', callbackErr);
    }
  });

  // Suppresses EPIPE errors that are emitted on stdin when the child process
  // exits while a write is in flight. Without this listener the error would
  // propagate as an unhandled stream error and crash the process.
  child.stdin?.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EPIPE') {
      console.error('[InteractiveCommandRunner] stdin error:', err);
    }
  });

  return {
    write(text: string): void {
      if (!child.stdin || child.killed || child.stdin.destroyed) {
        throw new Error(
          'Cannot write to process: stdin is unavailable or process has exited'
        );
      }
      child.stdin.write(text + '\n');
    },
    close(): void {
      if (!child.killed) {
        child.stdin?.end();
        child.kill();
      }
    },
    get pid() {
      return child.pid;
    }
  };
}
