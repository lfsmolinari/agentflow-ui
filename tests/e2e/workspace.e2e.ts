import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'out/main/index.js');

// Allow up to 25 s for the app to transition out of the 'checking' state.
// The CLI command timeout in command-runner.ts is 15 s; this gives 10 s of headroom.
const STATE_RESOLUTION_TIMEOUT = 25_000;

test.describe('Workspace flow', () => {

  test('"Start a new project" CTA is visible in authenticated empty shell', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => []);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.locator('h1')).toHaveText('Start a new project', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('workspace name appears in sidebar after add', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => []);
        ipcMain.removeHandler('agentflow:add-workspace');
        ipcMain.handle('agentflow:add-workspace', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.locator('h1')).toHaveText('Start a new project', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
      await window.getByRole('button', { name: 'Start a new project' }).click();
      await expect(window.getByText('my-project')).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('session list shows empty state when workspace has no sessions', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.getByText('my-project')).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
      await expect(window.locator('h1')).toHaveText('No chats yet', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('"+" button is visible after first workspace is present', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.getByText('my-project')).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
      // "New chat" button appears in the sidebar once a workspace is active
      await expect(window.getByRole('button', { name: 'New chat' }).first()).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

});
