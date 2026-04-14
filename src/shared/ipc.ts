import type { StartupState } from './startup-state';

export interface LoginResponse {
  state: StartupState;
}

export interface AgentflowApi {
  getStartupState: () => Promise<StartupState>;
  refreshAuthState: () => Promise<StartupState>;
  openCopilotInstallInstructions: () => Promise<void>;
  loginWithGitHub: () => Promise<LoginResponse>;
  loginWithGitHubEnterprise: (host: string) => Promise<LoginResponse>;
  onLoginOutput: (callback: (chunk: string) => void) => () => void;
}

export const IPC_CHANNELS = {
  getStartupState: 'agentflow:get-startup-state',
  refreshAuthState: 'agentflow:refresh-auth-state',
  openInstallDocs: 'agentflow:open-install-docs',
  loginWithGitHub: 'agentflow:login-github',
  loginWithEnterprise: 'agentflow:login-enterprise',
  loginOutput: 'agentflow:login-output'
} as const;
