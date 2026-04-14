import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'out/main/index.js');

test.describe('Startup flow', () => {
  test('app reaches a stable startup state without hanging on loading screen', async () => {
    const app = await electron.launch({ args: [appPath] });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const heading = window.locator('h1');
      await expect(heading).toBeVisible({ timeout: 15_000 });

      const text = (await heading.textContent())?.trim();
      expect(
        ['Copilot CLI required', 'Sign in to continue'],
        `Unexpected startup state heading: "${text}". App must resolve to install gate or login screen.`
      ).toContain(text);
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
      await expect(heading).toBeVisible({ timeout: 15_000 });

      await expect(
        heading,
        'Expected login screen ("Sign in to continue").\n' +
        'Got install gate ("Copilot CLI required") instead.\n' +
        'This means the app could not find the copilot executable on PATH.\n' +
        'Check src/infrastructure/system/command-runner.ts env configuration.'
      ).toHaveText('Sign in to continue');
    } finally {
      await app.close();
    }
  });
});
