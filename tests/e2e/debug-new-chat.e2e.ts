import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

/**
 * Manual debug script for the New Chat flow.
 *
 * Run with:
 *   COPILOT_AUTHENTICATED=1 npx playwright test tests/e2e/debug-new-chat.e2e.ts --headed
 *
 * Requires:
 *   - Copilot CLI installed and authenticated (`copilot auth status`)
 *   - App built: `npm run build`
 *   - COPILOT_AUTHENTICATED=1 env var set
 */

const appPath = join(process.cwd(), 'out/main/index.js');

test.describe('Debug: New Chat flow', () => {
  test.skip(
    process.env.COPILOT_AUTHENTICATED !== '1',
    'Skipped: set COPILOT_AUTHENTICATED=1. Requires Copilot CLI installed and logged in.'
  );

  test('steps through New Chat and reports what happens', async () => {
    test.setTimeout(120_000);

    // ── Step 1: Launch app ───────────────────────────────────────────────────
    console.log('[debug] Step 1: Launching Electron app from', appPath);
    const app = await electron.launch({ args: [appPath] });

    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');
      console.log('[debug] App window loaded');

      // ── Step 2: Wait for authenticated shell ─────────────────────────────
      console.log('[debug] Step 2: Waiting for authenticated shell (up to 30s)...');
      const workspacesHeading = window.locator('h2', { hasText: /WORKSPACES/i });
      await expect(workspacesHeading).toBeVisible({ timeout: 30_000 });
      console.log('[debug] Authenticated shell is visible');

      // ── Step 3: Log sidebar contents ──────────────────────────────────────
      console.log('[debug] Step 3: Reading sidebar contents...');
      const sidebarText = await window.locator('aside').innerText().catch(() => '(failed to read sidebar)');
      console.log('[debug] Sidebar text:\n', sidebarText);

      // ── Step 4: Select workspace if one is available ─────────────────────
      console.log('[debug] Step 4: Checking for workspace items...');
      const workspaceItems = window.locator('aside button[class*="rounded-control"]').filter({ hasNotText: /New chat|Starting|Log out|Settings/i });
      const workspaceCount = await workspaceItems.count();
      console.log(`[debug] Found ${workspaceCount} workspace button(s)`);

      if (workspaceCount > 0) {
        const firstWorkspace = workspaceItems.first();
        const wsLabel = await firstWorkspace.innerText().catch(() => '(unknown)');
        console.log(`[debug] Clicking workspace: "${wsLabel}"`);
        await firstWorkspace.click();
        // Wait briefly for workspace selection to settle
        await window.waitForTimeout(500);
      } else {
        console.log('[debug] No workspaces found — skipping workspace selection');
      }

      // ── Step 5: Find and click "+ New chat" button ───────────────────────
      console.log('[debug] Step 5: Looking for New chat button...');
      const newChatButton = window.locator('button', { hasText: /New chat/i }).first();
      const newChatVisible = await newChatButton.isVisible().catch(() => false);
      console.log(`[debug] New chat button visible: ${newChatVisible}`);

      if (!newChatVisible) {
        console.log('[debug] New chat button not found — taking screenshot and aborting');
        await window.screenshot({ path: '/tmp/debug-new-chat-no-button.png' });
        console.log('[debug] Screenshot saved to /tmp/debug-new-chat-no-button.png');
        expect(newChatVisible, 'New chat button should be visible').toBe(true);
        return;
      }

      await newChatButton.click();
      console.log('[debug] Clicked New chat button');

      // ── Step 6: Observe what happens immediately after click ─────────────
      console.log('[debug] Step 6: Observing immediate UI reaction...');
      await window.waitForTimeout(300);

      const startingButton = window.locator('button', { hasText: /Starting…/i });
      const isShowingLoading = await startingButton.isVisible().catch(() => false);
      console.log(`[debug] Button shows "Starting…": ${isShowingLoading}`);

      const currentSidebarText = await window.locator('aside').innerText().catch(() => '(failed)');
      console.log('[debug] Sidebar after click:\n', currentSidebarText);

      // Capture renderer console state for diagnostics
      await window.evaluate(() => {
        console.log('[renderer] viewState inspection triggered by debug script');
      });

      // ── Step 7: Wait up to 60s for ChatView or an error ──────────────────
      console.log('[debug] Step 7: Waiting up to 60s for chat view or error...');
      const chatInput = window.locator('textarea, [role="textbox"]');
      const errorMessage = window.locator('text=/error|failed|unable/i');

      let outcome = 'timeout';
      try {
        await Promise.race([
          chatInput.waitFor({ state: 'visible', timeout: 60_000 }).then(() => { outcome = 'chat_view'; }),
          errorMessage.first().waitFor({ state: 'visible', timeout: 60_000 }).then(() => { outcome = 'error_shown'; }),
        ]);
      } catch {
        outcome = 'timeout';
      }
      console.log(`[debug] Outcome after waiting: ${outcome}`);

      // ── Step 8: Take a screenshot ─────────────────────────────────────────
      console.log('[debug] Step 8: Taking screenshot...');
      await window.screenshot({ path: '/tmp/debug-new-chat.png' });
      console.log('[debug] Screenshot saved to /tmp/debug-new-chat.png');

      // Log final sidebar state
      const finalSidebar = await window.locator('aside').innerText().catch(() => '(failed)');
      console.log('[debug] Final sidebar text:\n', finalSidebar);

      const finalMain = await window.locator('main').innerText().catch(() => '(no main element)');
      console.log('[debug] Final main content (first 500 chars):\n', finalMain.slice(0, 500));

      // ── Step 9: Soft assertion that something changed ─────────────────────
      console.log('[debug] Step 9: Running soft assertions...');
      expect.soft(outcome, 'Expected chat view or error to appear within 60s').not.toBe('timeout');

      if (outcome === 'chat_view') {
        console.log('[debug] SUCCESS: ChatView rendered — new chat flow works');
      } else if (outcome === 'error_shown') {
        console.log('[debug] PARTIAL: An error message appeared — check UI for details');
      } else {
        console.log('[debug] FAIL: Nothing changed within 60s — likely a silent hang in startNewSession');
      }
    } finally {
      await app.close();
      console.log('[debug] App closed');
    }
  });
});
