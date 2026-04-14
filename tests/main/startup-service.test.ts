import { describe, expect, it, vi } from 'vitest';
import type { CopilotCliAdapter } from '@infra/copilot/adapter';
import type { AuthProbeResult } from '@shared/startup-state';
import { StartupService } from '@main/startup-service';

type CopilotAdapterShape = Pick<
  CopilotCliAdapter,
  'isInstalled' | 'probeAuthState' | 'loginWithGitHub' | 'loginWithEnterprise'
>;

const createCopilotAdapter = (overrides: Partial<CopilotAdapterShape> = {}): CopilotCliAdapter => {
  const adapter: CopilotAdapterShape = {
    isInstalled: async () => true,
    probeAuthState: async () => ({ authenticated: true }),
    loginWithGitHub: async () => {},
    loginWithEnterprise: async () => {},
    ...overrides
  };

  return adapter as CopilotCliAdapter;
};

describe('StartupService.getStartupState()', () => {
  it('returns copilot_missing when adapter reports not installed', async () => {
    const service = new StartupService(
      createCopilotAdapter({ isInstalled: async () => false })
    );

    const state = await service.getStartupState();

    expect(state.kind).toBe('copilot_missing');
  });

  it('returns authenticated when adapter reports authenticated', async () => {
    const service = new StartupService(
      createCopilotAdapter({ probeAuthState: async () => ({ authenticated: true }) })
    );

    const state = await service.getStartupState();

    expect(state.kind).toBe('authenticated');
  });

  it('returns unauthenticated with reason preserved when adapter reports not authenticated', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        probeAuthState: async () => ({
          authenticated: false,
          reason: 'CLI reported not logged in.'
        })
      })
    );

    const state = await service.getStartupState();

    expect(state.kind).toBe('unauthenticated');
    expect(state.description).toBe('CLI reported not logged in.');
  });

  it('returns error when adapter throws unexpectedly', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        probeAuthState: async () => {
          throw new Error('Unexpected probe failure.');
        }
      })
    );

    const state = await service.getStartupState();

    expect(state.kind).toBe('error');
  });
});

describe('StartupService.loginWithGitHubEnterprise()', () => {
  it('returns error and never calls adapter for an invalid host', async () => {
    const loginWithEnterprise = vi.fn<() => Promise<void>>();

    const service = new StartupService(
      createCopilotAdapter({ loginWithEnterprise })
    );

    const result = await service.loginWithGitHubEnterprise('not valid!');

    expect(result.state.kind).toBe('error');
    expect(loginWithEnterprise).not.toHaveBeenCalled();
  });

  it('returns authenticated when a valid host resolves and auth refresh succeeds', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        loginWithEnterprise: async () => {},
        probeAuthState: async () => ({ authenticated: true })
      })
    );

    const result = await service.loginWithGitHubEnterprise('github.example.com');

    expect(result.state.kind).toBe('authenticated');
  });

  it('returns error with safe message when adapter throws for a valid host', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        loginWithEnterprise: async () => {
          throw new Error('raw CLI output: token expired');
        }
      })
    );

    const result = await service.loginWithGitHubEnterprise('github.example.com');

    expect(result.state.kind).toBe('error');
    expect(result.state.description).toBe(
      'Authentication failed. Please try again or run the Copilot CLI directly.'
    );
  });
});

describe('StartupService.loginWithGitHub()', () => {
  it('returns authenticated when loginWithGitHub resolves and probeAuthState returns authenticated', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        loginWithGitHub: async () => {},
        probeAuthState: async () => ({ authenticated: true })
      })
    );

    const result = await service.loginWithGitHub();

    expect(result.state.kind).toBe('authenticated');
  });

  it('returns error with safe generic message when adapter loginWithGitHub throws', async () => {
    const service = new StartupService(
      createCopilotAdapter({
        loginWithGitHub: async () => {
          throw new Error('raw CLI output');
        }
      })
    );

    const result = await service.loginWithGitHub();

    expect(result.state.kind).toBe('error');
    expect(result.state.description).toBe(
      'Authentication failed. Please try again or run the Copilot CLI directly.'
    );
  });
});

describe('StartupService login refresh behavior', () => {
  it('preserves refreshAuthState error results after login', async () => {
    const probeAuthState = vi
      .fn<() => Promise<AuthProbeResult>>()
      .mockRejectedValue(new Error('Probe failed unexpectedly.'));
    const loginWithGitHub = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const service = new StartupService(
      createCopilotAdapter({
        probeAuthState,
        loginWithGitHub
      })
    );

    const result = await service.loginWithGitHub();

    expect(result.state.kind).toBe('error');
    expect(result.state.description).toBe('Probe failed unexpectedly.');
  });

  it('uses generic unauthenticated feedback only when refresh resolves unauthenticated', async () => {
    const probeAuthState = vi
      .fn<() => Promise<AuthProbeResult>>()
      .mockResolvedValue({ authenticated: false, reason: 'CLI reported not logged in.' });
    const loginWithGitHub = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const service = new StartupService(
      createCopilotAdapter({
        probeAuthState,
        loginWithGitHub
      })
    );

    const result = await service.loginWithGitHub();

    expect(result.state.kind).toBe('unauthenticated');
    expect(result.state.description).toBe(
      'Authentication did not complete successfully. Please try again.'
    );
    expect(result.state.retryable).toBe(true);
  });
});
