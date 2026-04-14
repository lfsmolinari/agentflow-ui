# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: startup.e2e.ts >> Startup flow >> app reaches a stable startup state without hanging on loading screen
- Location: tests\e2e\startup.e2e.ts:7:3

# Error details

```
Error: Unexpected startup state heading: "Checking environment". App must resolve to install gate or login screen.

expect(received).toContain(expected) // indexOf

Expected value: "Checking environment"
Received array: ["Copilot CLI required", "Sign in to continue"]
```

# Test source

```ts
  1  | import { test, expect, _electron as electron } from '@playwright/test';
  2  | import { join } from 'node:path';
  3  | 
  4  | const appPath = join(process.cwd(), 'out/main/index.js');
  5  | 
  6  | test.describe('Startup flow', () => {
  7  |   test('app reaches a stable startup state without hanging on loading screen', async () => {
  8  |     const app = await electron.launch({ args: [appPath] });
  9  |     try {
  10 |       const window = await app.firstWindow();
  11 |       await window.waitForLoadState('domcontentloaded');
  12 | 
  13 |       const heading = window.locator('h1');
  14 |       await expect(heading).toBeVisible({ timeout: 15_000 });
  15 | 
  16 |       const text = (await heading.textContent())?.trim();
  17 |       expect(
  18 |         ['Copilot CLI required', 'Sign in to continue'],
  19 |         `Unexpected startup state heading: "${text}". App must resolve to install gate or login screen.`
> 20 |       ).toContain(text);
     |         ^ Error: Unexpected startup state heading: "Checking environment". App must resolve to install gate or login screen.
  21 |     } finally {
  22 |       await app.close();
  23 |     }
  24 |   });
  25 | 
  26 |   test('shows login screen when Copilot CLI is installed', async () => {
  27 |     test.skip(
  28 |       process.env.COPILOT_CLI_INSTALLED !== '1',
  29 |       'Skipped: set COPILOT_CLI_INSTALLED=1 to run this test on machines with Copilot CLI installed.'
  30 |     );
  31 |     const app = await electron.launch({ args: [appPath] });
  32 |     try {
  33 |       const window = await app.firstWindow();
  34 |       await window.waitForLoadState('domcontentloaded');
  35 | 
  36 |       const heading = window.locator('h1');
  37 |       await expect(heading).toBeVisible({ timeout: 15_000 });
  38 | 
  39 |       await expect(
  40 |         heading,
  41 |         'Expected login screen ("Sign in to continue").\n' +
  42 |         'Got install gate ("Copilot CLI required") instead.\n' +
  43 |         'This means the app could not find the copilot executable on PATH.\n' +
  44 |         'Check src/infrastructure/system/command-runner.ts env configuration.'
  45 |       ).toHaveText('Sign in to continue');
  46 |     } finally {
  47 |       await app.close();
  48 |     }
  49 |   });
  50 | });
  51 | 
```