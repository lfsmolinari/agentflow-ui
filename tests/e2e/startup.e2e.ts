import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'out/main/index.js');

// Allow up to 25 s for the app to transition out of the 'checking' state.
// The CLI command timeout in command-runner.ts is 15 s; this gives 10 s of headroom.
const STATE_RESOLUTION_TIMEOUT = 25_000;

test.describe('Startup flow', () => {
  test('app reaches a stable startup state without hanging on loading screen', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');

      // Poll until the heading contains one of the two stable states.
      // This correctly waits past the transient 'Checking environment' state.
      await expect(heading).toHaveText(
        /^(Copilot CLI required|Sign in to continue|Start a new project)$/,
        { timeout: STATE_RESOLUTION_TIMEOUT }
      );
    } finally {
      await app.close();
    }
  });

  test('shows login screen when Copilot CLI is installed', async () => {
    test.skip(
      process.env.COPILOT_CLI_INSTALLED !== '1',
      'Skipped: set COPILOT_CLI_INSTALLED=1 to run this test on machines with Copilot CLI installed.'
    );
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');

      await expect(
        heading,
        'Expected login screen ("Sign in to continue").\n' +
        'Got install gate ("Copilot CLI required") instead.\n' +
        'This means the app could not find the copilot executable on PATH.\n' +
        'Check src/infrastructure/system/command-runner.ts env configuration.'
      ).toHaveText('Sign in to continue', { timeout: STATE_RESOLUTION_TIMEOUT });
    } finally {
      await app.close();
    }
  });
});
