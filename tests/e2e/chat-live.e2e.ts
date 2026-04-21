import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

const appPath = join(process.cwd(), 'out/main/index.js');

// Allow up to 25 s for the app to transition out of the 'checking' state.
const STATE_RESOLUTION_TIMEOUT = 25_000;

test.describe('Live chat flow', () => {
  test.setTimeout(120_000);

  test.beforeEach(() => {
    test.skip(
      process.env.COPILOT_AUTHENTICATED !== '1',
      'Skipped: set COPILOT_AUTHENTICATED=1 to run live CLI tests'
    );
  });

  test('sends "hi" and receives a streaming response from Copilot CLI', async () => {
    const workspacePath = join(os.tmpdir(), `agentflow-live-test-${Date.now()}`);
    fs.mkdirSync(workspacePath, { recursive: true });

    const app = await electron.launch({ args: [appPath] });
    try {
      await app.evaluate(({ ipcMain }, wp: string) => {
        const name = wp.split('/').pop() ?? 'live-test';
        ipcMain.removeHandler('agentflow:list-workspaces');
        ipcMain.handle('agentflow:list-workspaces', () => [{ path: wp, name }]);
        ipcMain.removeHandler('agentflow:add-workspace');
        ipcMain.handle('agentflow:add-workspace', () => [{ path: wp, name }]);
        ipcMain.removeHandler('agentflow:list-sessions');
        ipcMain.handle('agentflow:list-sessions', () => []);
      }, workspacePath);

      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Workspace is returned by listWorkspaces immediately, so the app should
      // auto-select it and show the session empty state.
      await expect(window.locator('h1')).toHaveText('No chats yet', {
        timeout: STATE_RESOLUTION_TIMEOUT,
      });

      // Start a new chat — this invokes the real startNewSession via Copilot CLI.
      await window.getByRole('button', { name: 'New chat' }).first().click();

      const textarea = window.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: STATE_RESOLUTION_TIMEOUT });

      // Type "hi" and send.
      await textarea.fill('hi');
      await window.getByRole('button', { name: 'Send' }).click();

      // User turn should appear in the transcript immediately.
      await expect(window.locator('[data-role="user"]').filter({ hasText: 'hi' })).toBeVisible({
        timeout: STATE_RESOLUTION_TIMEOUT,
      });

      // Wait for the assistant response — any text streamed back from the CLI.
      const assistantMessage = window.locator('[data-role="assistant"]').first();
      await expect(assistantMessage).toBeVisible({ timeout: 90_000 });

      // Composer textarea should be re-enabled once streaming completes.
      await expect(textarea).toBeEnabled({ timeout: 90_000 });
    } finally {
      await app.close();
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });
});
