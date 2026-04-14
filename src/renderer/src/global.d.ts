import type { AgentflowApi } from '@shared/ipc';

declare global {
  interface Window {
    agentflow: AgentflowApi;
  }
}

export {};
