import type { StartupState } from './startup-state';
import type { Workspace, Session, ChatMessage } from './workspace-types';

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
  logout: () => Promise<StartupState>;
  listWorkspaces: () => Promise<Workspace[]>;
  addWorkspace: () => Promise<Workspace[]>;
  listSessions: (workspacePath: string) => Promise<Session[]>;
  startNewSession: (workspacePath: string) => Promise<{ session: Session } | { error: string }>;
  openSession: (sessionId: string) => Promise<ChatMessage[]>;
  sendMessage: (sessionId: string, text: string) => Promise<{ error: string } | undefined>;
  onChatOutput: (callback: (chunk: string) => void) => () => void;
  closeSession: (sessionId: string) => Promise<void>;
}

export const IPC_CHANNELS = {
  getStartupState: 'agentflow:get-startup-state',
  refreshAuthState: 'agentflow:refresh-auth-state',
  openInstallDocs: 'agentflow:open-install-docs',
  loginWithGitHub: 'agentflow:login-github',
  loginWithEnterprise: 'agentflow:login-enterprise',
  loginOutput: 'agentflow:login-output',
  logout: 'agentflow:logout',
  listWorkspaces: 'agentflow:list-workspaces',
  addWorkspace: 'agentflow:add-workspace',
  listSessions: 'agentflow:list-sessions',
  startNewSession: 'agentflow:start-new-session',
  openSession: 'agentflow:open-session',
  sendMessage: 'agentflow:send-message',
  chatOutput: 'agentflow:chat-output',
  closeSession: 'agentflow:close-session'
} as const;
