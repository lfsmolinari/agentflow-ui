import { contextBridge, ipcRenderer } from 'electron';
import type { AgentflowApi } from '@shared/ipc';
import { IPC_CHANNELS } from '@shared/ipc';

const api: AgentflowApi = {
  getStartupState: () => ipcRenderer.invoke(IPC_CHANNELS.getStartupState),
  refreshAuthState: () => ipcRenderer.invoke(IPC_CHANNELS.refreshAuthState),
  openCopilotInstallInstructions: () => ipcRenderer.invoke(IPC_CHANNELS.openInstallDocs),
  loginWithGitHub: () => ipcRenderer.invoke(IPC_CHANNELS.loginWithGitHub),
  loginWithGitHubEnterprise: (host) => ipcRenderer.invoke(IPC_CHANNELS.loginWithEnterprise, host),
  onLoginOutput: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.loginOutput, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.loginOutput, handler); };
  }
};

contextBridge.exposeInMainWorld('agentflow', api);
