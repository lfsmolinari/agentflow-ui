import { normalizeEnterpriseHost } from '@shared/enterprise-host';
import type { LoginResponse } from '@shared/ipc';
import { startupState, type StartupState } from '@shared/startup-state';
import { CopilotCliAdapter } from '@infra/copilot/adapter';

export class StartupService {
  constructor(private readonly copilot = new CopilotCliAdapter()) {}

  async getStartupState(): Promise<StartupState> {
    try {
      const installed = await this.copilot.isInstalled();
      if (!installed) {
        return startupState('copilot_missing');
      }

      const authState = await this.copilot.probeAuthState();
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
    return this.getStartupState();
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

  private async runLogin(action: () => Promise<void>): Promise<LoginResponse> {
    try {
      await action();
      const refreshed = await this.refreshAuthState();

      if (refreshed.kind === 'authenticated') {
        return { state: refreshed };
      }

      if (refreshed.kind !== 'unauthenticated') {
        return { state: refreshed };
      }

      return {
        state: startupState('unauthenticated', {
          description: 'Authentication did not complete successfully. Please try again.',
          retryable: true
        })
      };
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
