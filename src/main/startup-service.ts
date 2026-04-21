import { normalizeEnterpriseHost } from '@shared/enterprise-host';
import type { LoginResponse } from '@shared/ipc';
import { startupState, type StartupState, type AuthProbeResult } from '@shared/startup-state';
import { CopilotCliAdapter } from '@infra/copilot/adapter';

interface AuthProber {
  probeAuthState(): Promise<AuthProbeResult>;
}

export class StartupService {
  constructor(
    private readonly copilot = new CopilotCliAdapter(),
    private readonly sdkProber?: AuthProber
  ) {}

  async getStartupState(): Promise<StartupState> {
    try {
      const installed = await this.copilot.isInstalled();
      if (!installed) {
        return startupState('copilot_missing');
      }

      const prober: AuthProber = this.sdkProber ?? this.copilot;
      const authState = await prober.probeAuthState();
      return authState.authenticated
        ? startupState('authenticated')
        : startupState('unauthenticated', {
            description: authState.reason ?? startupState('unauthenticated').description
          });
    } catch (error) {
      return startupState('error', {
        description: error instanceof Error ? error.message : startupState('error').description
      });
    }
  }

  async refreshAuthState(): Promise<StartupState> {
    try {
      const prober: AuthProber = this.sdkProber ?? this.copilot;
      const authState = await prober.probeAuthState();
      return authState.authenticated
        ? startupState('authenticated')
        : startupState('unauthenticated', {
            description: authState.reason ?? startupState('unauthenticated').description
          });
    } catch (error) {
      const stillInstalled = await this.copilot.isInstalled().catch(() => false);
      if (!stillInstalled) {
        return startupState('copilot_missing');
      }
      return startupState('error', {
        description: error instanceof Error ? error.message : startupState('error').description
      });
    }
  }

  async loginWithGitHub(onData?: (chunk: string) => void): Promise<LoginResponse> {
    return this.runLogin(() => this.copilot.loginWithGitHub(onData));
  }

  async loginWithGitHubEnterprise(host: string, onData?: (chunk: string) => void): Promise<LoginResponse> {
    const normalized = normalizeEnterpriseHost(host);
    if (!normalized.ok) {
      return {
        state: startupState('error', {
          description: normalized.error ?? 'Invalid GitHub Enterprise hostname.',
          retryable: true
        })
      };
    }

    return this.runLogin(() => this.copilot.loginWithEnterprise(normalized.host!, onData));
  }

  async logout(): Promise<StartupState> {
    try {
      await this.copilot.logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed. Please try again.';
      return startupState('error', { description: message, retryable: true });
    }
    return startupState('unauthenticated');
  }

  private async runLogin(action: () => Promise<void>): Promise<LoginResponse> {
    try {
      await action();
      // copilot login exits 0 only after credentials are saved — trust the exit code.
      // Re-probing via the SDK immediately after login is unreliable because the new
      // CopilotClient process may not have loaded credentials by the time listSessions() runs.
      return { state: startupState('authenticated') };
    } catch (error) {
      console.error('[StartupService] Login failed:', error);
      return {
        state: startupState('error', {
          description: 'Authentication failed. Please try again or run the Copilot CLI directly.',
          retryable: true
        })
      };
    }
  }
}
