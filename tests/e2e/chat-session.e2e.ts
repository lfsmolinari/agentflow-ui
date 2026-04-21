import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const appPath = join(process.cwd(), 'out/main/index.js');

test.describe('Chat session', () => {
  test(
    'startNewSession creates session directory and sendMessage returns a response',
    async () => {
      test.skip(
        process.env.COPILOT_AUTHENTICATED !== '1',
        'Skipped: set COPILOT_AUTHENTICATED=1. Requires Copilot CLI installed and logged in.'
      );

      test.setTimeout(180_000);

      const tempWorkspace = join(tmpdir(), `agentflow-e2e-${randomUUID()}`);
      mkdirSync(tempWorkspace, { recursive: true });

      const app = await electron.launch({ args: [appPath] });

      try {
        const window = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');

        // Start a new session
        const result = await window.evaluate(
          (workspacePath) => (window as unknown as { agentflow: { startNewSession(p: string): Promise<{ session: { id: string } } | { error: string }> } }).agentflow.startNewSession(workspacePath),
          tempWorkspace
        );

        expect(result).toHaveProperty('session');
        const sessionId: string = (result as { session: { id: string } }).session.id;
        expect(typeof sessionId).toBe('string');
        expect(sessionId.length).toBeGreaterThan(0);

        // Assert session directory was created on disk
        const sessionDir = join(homedir(), '.copilot', 'session-state', sessionId);
        expect(existsSync(sessionDir)).toBe(true);

        // Subscribe to chatOutput, then send a message
        await window.evaluate(() => {
          (window as unknown as { agentflow: { onChatOutput(cb: (chunk: string) => void): void }; __e2eChunks: string[] }).agentflow.onChatOutput((chunk: string) => {
            const w = window as unknown as { __e2eChunks?: string[] };
            w.__e2eChunks = w.__e2eChunks ?? [];
            w.__e2eChunks.push(chunk);
          });
        });

        await window.evaluate(
          ([sid, msg]) => (window as unknown as { agentflow: { sendMessage(s: string, m: string): Promise<void> } }).agentflow.sendMessage(sid, msg),
          [sessionId, 'hi'] as [string, string]
        );

        const chunks: string[] = await window.evaluate(
          () => (window as unknown as { __e2eChunks?: string[] }).__e2eChunks ?? []
        );

        expect(chunks.join('')).toBeTruthy();

        // Clean up: close the session process
        await window.evaluate(
          (sid) => (window as unknown as { agentflow?: { closeSession?(s: string): Promise<void> } }).agentflow?.closeSession?.(sid),
          sessionId
        );
      } finally {
        await app.close();
        try { rmSync(tempWorkspace, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }
  );
});
