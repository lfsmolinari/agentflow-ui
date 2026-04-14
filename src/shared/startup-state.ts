export type StartupStateKind =
  | 'checking'
  | 'copilot_missing'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'error';

export interface StartupState {
  kind: StartupStateKind;
  title: string;
  description: string;
  retryable?: boolean;
}

export interface AuthProbeResult {
  authenticated: boolean;
  reason?: string;
}

export const startupState = (kind: StartupStateKind, overrides?: Partial<StartupState>): StartupState => {
  const defaults: Record<StartupStateKind, StartupState> = {
    checking: {
      kind: 'checking',
      title: 'Checking environment',
      description: 'Inspecting Copilot CLI availability and authentication state.'
    },
    copilot_missing: {
      kind: 'copilot_missing',
      title: 'Copilot CLI required',
      description: 'Install GitHub Copilot CLI to continue. Restart AgentFlow UI after installation.'
    },
    unauthenticated: {
      kind: 'unauthenticated',
      title: 'Sign in to continue',
      description: 'Authenticate through Copilot CLI using GitHub or GitHub Enterprise Cloud.'
    },
    authenticating: {
      kind: 'authenticating',
      title: 'Authenticating',
      description: 'Complete authentication in your browser. We will refresh your Copilot state automatically.'
    },
    authenticated: {
      kind: 'authenticated',
      title: 'Ready',
      description: 'Copilot CLI is installed and authenticated.'
    },
    error: {
      kind: 'error',
      title: 'Something went wrong',
      description: 'We could not determine the Copilot CLI status.',
      retryable: true
    }
  };

  return { ...defaults[kind], ...overrides };
};
