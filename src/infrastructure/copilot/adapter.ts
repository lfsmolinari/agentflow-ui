import type { AuthProbeResult } from '@shared/startup-state';
import { createCommandRunner, type CommandRunner, type CommandResult } from '../system/command-runner';

const authenticatedPattern = /authenticated|logged in|already logged in/i;
const unauthenticatedPattern = /not logged in|login required|unauthenticated/i;

const defaultRunner = createCommandRunner();

const parseAuthStatus = (result: CommandResult): AuthProbeResult => {
  const combined = `${result.stdout}\n${result.stderr}`.trim();

  // Try JSON first — the CLI responds with structured output when --json is passed
  try {
    const parsed = JSON.parse(result.stdout.trim());

    // Explicit boolean field (hypothetical future format)
    if (typeof parsed.authenticated === 'boolean') {
      return parsed.authenticated
        ? { authenticated: true }
        : { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
    }

    // Explicit unauthenticated status
    if (
      parsed.status === 'unauthenticated' ||
      parsed.status === 'not_logged_in' ||
      parsed.error
    ) {
      return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
    }

    // Any valid JSON response on exit 0 means authenticated
    // (copilot auth status --json only returns structured data when auth is present)
    if (result.exitCode === 0) {
      return { authenticated: true };
    }

    // Valid JSON but non-zero exit — unauthenticated
    return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
  } catch {
    // Not JSON — fall through to text parsing
  }

  // Text-based fallback
  if (result.exitCode === 0 && authenticatedPattern.test(combined) && !unauthenticatedPattern.test(combined)) {
    return { authenticated: true };
  }

  if (unauthenticatedPattern.test(combined)) {
    return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
  }

  if (result.exitCode === 0) {
    // Exit 0 with unrecognised text output — optimistically treat as authenticated
    return { authenticated: true };
  }

  console.error(`[CopilotCliAdapter] parseAuthStatus: unexpected output (exit ${result.exitCode})`);
  throw new Error('Unable to determine Copilot CLI authentication state.');
};

export class CopilotCliAdapter {
  constructor(private readonly runner: CommandRunner = defaultRunner) {}

  async isInstalled(): Promise<boolean> {
    try {
      const result = await this.runner.run('copilot', ['--version']);
      console.log('[isInstalled] exitCode:', result.exitCode, 'stdout:', result.stdout.trim(), 'stderr:', result.stderr.trim());
      if (result.exitCode !== 0) return false;
      const combined = `${result.stdout}\n${result.stderr}`;
      // VS Code ships a shim that outputs this when the real CLI is missing
      if (combined.includes('Cannot find GitHub Copilot CLI')) return false;
      return true;
    } catch (e) {
      console.error('[isInstalled] threw:', e);
      return false;
    }
  }

  async probeAuthState(): Promise<AuthProbeResult> {
    const result = await this.runner.run('copilot', ['auth', 'status', '--json']);
    return parseAuthStatus(result);
  }

  async loginWithGitHub(onData?: (chunk: string) => void): Promise<void> {
    const result = await this.runner.run('copilot', ['login'], 5 * 60 * 1000, onData);

    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] loginWithGitHub failed (exit ${result.exitCode})`);
      throw new Error('GitHub login did not complete successfully.');
    }
  }

  async loginWithEnterprise(host: string, onData?: (chunk: string) => void): Promise<void> {
    const result = await this.runner.run('copilot', ['login', '--host', host], 5 * 60 * 1000, onData);

    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] loginWithEnterprise failed (exit ${result.exitCode})`);
      throw new Error('GitHub Enterprise login did not complete successfully.');
    }
  }

  async logout(): Promise<void> {
    const result = await this.runner.run('copilot', ['logout']);
    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] logout failed (exit ${result.exitCode})`);
      throw new Error('Logout failed. Please try again.');
    }
  }
}

export { parseAuthStatus };
