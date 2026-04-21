import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run: (command: string, args?: string[], timeoutMs?: number, onData?: (chunk: string) => void) => Promise<CommandResult>;
}

export const createCommandRunner = (): CommandRunner => ({
  run(command, args = [], timeoutMs = 15_000, onData?) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };

      const child = spawn(command, args, {
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let aborted = false;

      child.stdout.on('data', (chunk) => {
        if (!aborted) {
          stdout += String(chunk);
          onData?.(String(chunk));
        }
      });

      child.stderr.on('data', (chunk) => {
        if (!aborted) {
          stderr += String(chunk);
          onData?.(String(chunk));
        }
      });

      const timer = setTimeout(() => {
        aborted = true;
        child.kill('SIGTERM');
        const forcekill = process.platform === 'win32'
          ? () => child.kill()
          : () => child.kill('SIGKILL');
        const killGuard = setTimeout(forcekill, 3_000);
        child.once('close', () => clearTimeout(killGuard));
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
      }, timeoutMs);

      child.on('error', (error) => {
        aborted = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({
          exitCode,
          stdout,
          stderr
        });
      });
    });
  }
});
