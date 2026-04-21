import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'out/main/index.js');

// Allow up to 25 s for the app to transition out of the 'checking' state.
// The CLI command timeout in command-runner.ts is 15 s; this gives 10 s of headroom.
const STATE_RESOLUTION_TIMEOUT = 25_000;

test.describe('Session flow', () => {

  test('session list shows prior sessions for a workspace', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => [
          {
            id: 'session-1',
            title: 'My session',
            workspacePath: '/tmp/my-project',
            createdAt: new Date().toISOString(),
          },
        ]);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.getByText('My session')).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('"No chats yet" empty state when no sessions exist', async () => {
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

      await expect(window.locator('h1')).toHaveText('No chats yet', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('new chat transitions main panel to chat surface', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
        ipcMain.removeHandler('agentflow:start-new-session');
        ipcMain.handle('agentflow:start-new-session', () => ({
          session: {
            id: 'new-session-1',
            title: 'New chat',
            workspacePath: '/tmp/my-project',
            createdAt: new Date().toISOString(),
          }
        }));
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.locator('h1')).toHaveText('No chats yet', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
      await window.getByRole('button', { name: 'New chat' }).first().click();
      await expect(window.locator('textarea')).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

  test('sending a message shows user turn in transcript', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [
          { path: '/tmp/my-project', name: 'my-project' },
        ]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
        ipcMain.removeHandler('agentflow:start-new-session');
        ipcMain.handle('agentflow:start-new-session', () => ({
          session: {
            id: 'new-session-1',
            title: 'New chat',
            workspacePath: '/tmp/my-project',
            createdAt: new Date().toISOString(),
          }
        }));
        ipcMain.removeHandler('agentflow:send-message');
        ipcMain.handle('agentflow:send-message', () => undefined);
      });
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.locator('h1')).toHaveText('No chats yet', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
      await window.getByRole('button', { name: 'New chat' }).first().click();

      const textarea = window.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: STATE_RESOLUTION_TIMEOUT });
      await textarea.fill('Hello Strategist');
      await window.getByRole('button', { name: 'Send' }).click();

      await expect(window.locator('[data-role="user"]').filter({ hasText: 'Hello Strategist' })).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });
    } finally {
      await app.close();
    }
  });

});
