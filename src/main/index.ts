import { app, BrowserWindow, ipcMain, shell, Menu, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IPC_CHANNELS } from '@shared/ipc';
import { startupState } from '@shared/startup-state';
import { StartupService } from './startup-service';
import { WorkspaceService } from './workspace-service';
import { SessionService } from './session-service';
import { ChatService } from './chat-service';
import { validateEnterpriseHost } from './ipc-helpers';
import { COPILOT_INSTALL_URL } from '@infra/system/external-links';
import { CopilotSdkProvider } from '@infra/copilot/sdk-provider';

const __dirname = dirname(fileURLToPath(import.meta.url));
app.name = 'AgentFlow UI';
const chatProvider = new CopilotSdkProvider();
const startupService = new StartupService(undefined, chatProvider);
const workspaceService = new WorkspaceService();
const sessionService = new SessionService(chatProvider);
const chatService = new ChatService(chatProvider);

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#111216',
    icon: join(__dirname, '../renderer/AgentFlowUI-favicon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.NODE_ENV !== 'production' && process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(async () => {
  Menu.setApplicationMenu(
    process.platform === 'darwin'
      ? Menu.buildFromTemplate([{
          label: app.name,
          submenu: [
            { role: 'quit' }
          ]
        }])
      : Menu.buildFromTemplate([])
  );
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(join(__dirname, '../renderer/AgentFlowUI-favicon.png'));
  }
  ipcMain.handle(IPC_CHANNELS.getStartupState, () => startupService.getStartupState());
  ipcMain.handle(IPC_CHANNELS.refreshAuthState, () => startupService.refreshAuthState());
  ipcMain.handle(IPC_CHANNELS.openInstallDocs, async () => {
    await shell.openExternal(COPILOT_INSTALL_URL);
  });
  ipcMain.handle(IPC_CHANNELS.loginWithGitHub, (event) =>
    startupService.loginWithGitHub((chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.loginOutput, chunk);
      }
    })
  );
  ipcMain.handle(IPC_CHANNELS.loginWithEnterprise, (event, host: unknown) => {
    if (!validateEnterpriseHost(host)) {
      return { state: startupState('error', { description: 'Invalid request.', retryable: false }) };
    }
    return startupService.loginWithGitHubEnterprise(host, (chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.loginOutput, chunk);
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.logout, () => startupService.logout());

  ipcMain.handle(IPC_CHANNELS.listWorkspaces, () => workspaceService.load());

  ipcMain.handle(IPC_CHANNELS.addWorkspace, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) {
      return workspaceService.load();
    }
    return workspaceService.add(result.filePaths[0]);
  });

  ipcMain.handle(IPC_CHANNELS.listSessions, async (_event, workspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || workspacePath.trim() === '') return [];
    return sessionService.listSessions(workspacePath);
  });

  ipcMain.handle(IPC_CHANNELS.startNewSession, async (_event, workspacePath: unknown) => {
    console.log('[IPC] startNewSession called with:', workspacePath);
    if (typeof workspacePath !== 'string' || workspacePath.trim() === '') {
      const result = { error: 'Invalid workspacePath' };
      console.log('[IPC] startNewSession result:', JSON.stringify(result));
      return result;
    }
    try {
      const session = await chatService.startNewSession(workspacePath);
      const result = { session };
      console.log('[IPC] startNewSession result:', JSON.stringify(result));
      return result;
    } catch (err) {
      const result = { error: (err as Error).message };
      console.log('[IPC] startNewSession result:', JSON.stringify(result));
      return result;
    }
  });

  ipcMain.handle(IPC_CHANNELS.openSession, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || !/^[\w-]+$/.test(sessionId)) {
      return { error: 'Invalid session ID' };
    }
    return chatService.openSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.sendMessage, async (event, sessionId: unknown, text: unknown) => {
    console.log('[IPC] sendMessage called with sessionId:', sessionId);
    if (typeof sessionId !== 'string' || sessionId.trim() === '') return { error: 'Invalid sessionId' };
    if (typeof text !== 'string' || text.trim() === '') return { error: 'Invalid text' };
    try {
      await chatService.sendMessage(sessionId, text as string, (chunk) => {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.chatOutput, chunk);
          }
        } catch {
          // renderer was destroyed between the isDestroyed() check and send()
        }
      });
      console.log('[IPC] sendMessage completed for sessionId:', sessionId);
    } catch (err) {
      console.log('[IPC] sendMessage error for sessionId:', sessionId, (err as Error).message);
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.closeSession, (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || sessionId.trim() === '') return;
    chatService.closeSession(sessionId);
  });

  app.on('before-quit', () => chatService.closeAll());

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
