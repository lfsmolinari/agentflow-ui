import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'out/main/index.js');

// Allow up to 25 s for the app to transition out of the 'checking' state.
// The CLI command timeout in command-runner.ts is 15 s; this gives 10 s of headroom.
const STATE_RESOLUTION_TIMEOUT = 25_000;

// Minimal PATH that retains basic OS tools but excludes npm/Scoop/Volta/Homebrew globals.
// Used to simulate Copilot CLI not being installed without uninstalling it.
const pathWithoutCopilot = process.platform === 'win32'
  ? `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`
  : '/usr/bin:/bin';

test.describe('Startup flow', () => {

  // ── Always runs ─────────────────────────────────────────────────────────────

  test('app reaches a stable startup state without hanging on loading screen', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');
      await expect(heading).toHaveText(
        /^(Copilot CLI required|Sign in to continue|Start a new project)$/,
        { timeout: STATE_RESOLUTION_TIMEOUT }
      );
    } finally {
      await app.close();
    }
  });

  test('shows install gate when Copilot CLI is not on PATH', async () => {
    // Launch with a stripped PATH so copilot cannot be resolved — no uninstall needed.
    const app = await electron.launch({
      args: [appPath],
      env: { ...process.env, PATH: pathWithoutCopilot }
    });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');
      await expect(
        heading,
        'Expected install gate ("Copilot CLI required") when copilot is not on PATH.\n' +
        'If this fails, the app may be finding copilot via a path not covered by the stripped PATH.\n' +
        'Check src/infrastructure/system/command-runner.ts env configuration.'
      ).toHaveText('Copilot CLI required', { timeout: STATE_RESOLUTION_TIMEOUT });
    } finally {
      await app.close();
    }
  });

  // ── Requires specific machine state (gated by env var) ───────────────────────

  test('shows login screen when CLI is installed but not authenticated', async () => {
    test.skip(
      process.env.COPILOT_UNAUTHENTICATED !== '1',
      'Skipped: set COPILOT_UNAUTHENTICATED=1. Requires Copilot CLI installed and logged out (`copilot logout`).'
    );
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');
      await expect(
        heading,
        'Expected login screen ("Sign in to continue").\n' +
        '  → Got install gate: CLI not detected on PATH — check command-runner.ts env configuration.\n' +
        '  → Got authenticated shell: user is still logged in — run `copilot logout` first.'
      ).toHaveText('Sign in to continue', { timeout: STATE_RESOLUTION_TIMEOUT });
    } finally {
      await app.close();
    }
  });

  test('shows authenticated shell when CLI is installed and authenticated', async () => {
    test.skip(
      process.env.COPILOT_AUTHENTICATED !== '1',
      'Skipped: set COPILOT_AUTHENTICATED=1. Requires Copilot CLI installed and logged in (`copilot auth status`).'
    );
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');
      await expect(
        heading,
        'Expected authenticated shell ("Start a new project").\n' +
        '  → Got install gate: CLI not found on PATH.\n' +
        '  → Got login screen: user is not authenticated — run `copilot login` first.'
      ).toHaveText('Start a new project', { timeout: STATE_RESOLUTION_TIMEOUT });
    } finally {
      await app.close();
    }
  });

});
