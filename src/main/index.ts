import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IPC_CHANNELS } from '@shared/ipc';
import { startupState } from '@shared/startup-state';
import { StartupService } from './startup-service';
import { validateEnterpriseHost } from './ipc-helpers';
import { COPILOT_INSTALL_URL } from '@infra/system/external-links';

const __dirname = dirname(fileURLToPath(import.meta.url));
const startupService = new StartupService();

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#111216',
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
