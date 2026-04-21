import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { AgentflowApi } from '@shared/ipc';

declare global {
  interface Window {
    agentflow: AgentflowApi;
  }
}

const appPath = join(process.cwd(), 'out/main/index.js');
const STATE_RESOLUTION_TIMEOUT = 25_000;
const SESSION_TIMEOUT = 60_000;

test.describe('Agent execution flow', () => {
  test.skip(
    !process.env.COPILOT_AUTHENTICATED,
    'Skipped: set COPILOT_AUTHENTICATED=1. Requires Copilot CLI installed and logged in.'
  );

  test('can start a session, send a message, and receive a streaming response', async () => {
    test.setTimeout(SESSION_TIMEOUT);
    const workspaceDir = await mkdtemp(join(tmpdir(), 'agentflow-e2e-'));

    const app = await electron.launch({ args: [appPath] });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      // Wait for authenticated shell
      const heading = page.locator('h1');
      await expect(heading).toHaveText(
        /^(Start a new project|No chats yet)$/,
        { timeout: STATE_RESOLUTION_TIMEOUT }
      );

      // Add our temp workspace via the IPC bridge
      await page.evaluate(
        async () => {
          // addWorkspace opens a native dialog; we bypass by calling the underlying IPC directly.
          // The test workspace path must already exist (created above via mkdtemp).
          // We use the internal channel to inject without triggering the file dialog.
          return window.agentflow.addWorkspace().catch(() => {
            // Dialog may not open in headless mode; skip the dialog-based path.
          });
        },
        workspaceDir
      );

      // Start a new session via the IPC bridge
      const startResult = await page.evaluate(async (workspacePath: string) => {
        return window.agentflow.startNewSession(workspacePath);
      }, workspaceDir);

      expect(startResult).not.toHaveProperty('error');
      const session = (startResult as { session: { id: string; workspacePath: string } }).session;
      expect(session.id).toBeTruthy();
      expect(session.workspacePath).toBe(workspaceDir);

      // Collect streaming chunks via the onChatOutput listener
      await page.evaluate(() => {
        window.agentflow.onChatOutput((chunk: string) => {
          (window as unknown as { __e2eChunks: string[] }).__e2eChunks = [
            ...((window as unknown as { __e2eChunks?: string[] }).__e2eChunks ?? []),
            chunk,
          ];
        });
      });

      // Send a message
      const sendResult = await page.evaluate(
        async ({ sessionId, text }: { sessionId: string; text: string }) => {
          return window.agentflow.sendMessage(sessionId, text);
        },
        { sessionId: session.id, text: 'Hello, can you briefly introduce yourself in one sentence?' }
      );

      expect(sendResult).not.toHaveProperty('error');

      // Assert that at least one chunk arrived
      const receivedChunks = await page.evaluate(() => {
        return (window as unknown as { __e2eChunks?: string[] }).__e2eChunks ?? [];
      });

      expect(receivedChunks.length).toBeGreaterThan(0);
      expect(receivedChunks.join('')).toBeTruthy();

      // Close the session cleanly
      await page.evaluate(async (sessionId: string) => {
        return window.agentflow.closeSession(sessionId);
      }, session.id);

    } finally {
      await app.close();
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
