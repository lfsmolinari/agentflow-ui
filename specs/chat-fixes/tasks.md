# Tasks: Chat Fixes

## T01 — Path normalization in `listSessions` (Bug #1)

**Plan reference**: Phase 1
**Dependencies**: None

**Files**:
- `src/infrastructure/copilot/adapter.ts`
- `tests/infrastructure/copilot/adapter.test.ts`

**Changes**:

1. Add `import { realpathSync } from 'node:fs'` alongside the existing node imports.
2. Add a module-level helper function before `export class CopilotCliAdapter`:
   ```typescript
   function normalizePath(p: string): string {
     try { return realpathSync(p); } catch { return path.resolve(p); }
   }
   ```
3. In `listSessions`, before the `for` loop, add:
   ```typescript
   const normalizedWorkspacePath = normalizePath(workspacePath);
   ```
4. Replace the `cwdMatch` filter body:
   ```typescript
   typeof e.cwd === 'string' && normalizePath(e.cwd) === normalizedWorkspacePath
   ```
5. The `sessions.push(...)` call keeps the original `workspacePath` argument unchanged.

**Unit tests** — new `describe('CopilotCliAdapter.listSessions')` block in `adapter.test.ts`:

- Add `vi.mock('node:fs')` at the top of the file (alongside the existing `vi.mock('node:fs/promises')`).
- **Test A**: Mock `realpathSync` to return `/real/path` for both `/symlink/path` (the `e.cwd` value) and `/real/path` (the `workspacePath` argument). Mock `nodeFs.readdir` and `nodeFs.readFile` with a matching event. Assert `listSessions('/real/path')` returns one session.
- **Test B**: Mock `realpathSync` so `e.cwd` resolves to `/other/path` while `workspacePath` resolves to `/real/path`. Assert `listSessions` returns an empty array.
- **Test C**: Mock `realpathSync` to throw; assert `normalizePath` falls back to `path.resolve` output (call `normalizePath` via casting `adapter` to `unknown`).

**Acceptance criteria**:
- [ ] A session whose `e.cwd` is a symlink to the workspace path is returned by `listSessions`.
- [ ] A session with an unrelated `e.cwd` is excluded.
- [ ] `realpathSync` failure does not throw; `path.resolve` result is used instead.
- [ ] `npm test` passes.

---

## T02 — Permissive prompt pattern (Bug #2A)

**Plan reference**: Phase 2
**Dependencies**: None

**Files**:
- `src/infrastructure/copilot/adapter.ts`
- `tests/infrastructure/copilot/adapter.test.ts`

**Changes**:

1. On the `PROMPT_PATTERN` line (currently `{0,50}`), change to `{0,200}`:
   ```typescript
   const PROMPT_PATTERN = /(?:^|\r?\n)[\s\S]{0,200}[>?]\s*$/m;
   ```

**Unit tests** — add to the existing `describe('CopilotCliAdapter private helpers')` block:

- **Test A**: `hasPrompt` returns `true` for a buffer containing a prompt with a long prefix, e.g.:
  `'Starting Strategist agent for workspace /Users/dev/my-very-long-project-name...\n> '`
- **Test B**: `hasPrompt` returns `true` for the minimal prompt `'> '`.
- **Test C**: `hasPrompt` returns `false` for a buffer ending mid-sentence (no `>` or `?`).
- Verify all existing `hasPrompt` / `stripAnsi` tests still pass unchanged.

**Acceptance criteria**:
- [ ] `hasPrompt` returns `true` for a prompt prefix up to 200 characters long.
- [ ] No existing test regressions.
- [ ] `npm test` passes.

---

## T03 — `write()` error propagation (Bug #2B)

**Plan reference**: Phase 3
**Dependencies**: None

**Files**:
- `src/infrastructure/system/interactive-command-runner.ts`
- `src/infrastructure/copilot/adapter.ts`
- `tests/infrastructure/system/interactive-command-runner.test.ts` *(new file)*
- `tests/infrastructure/copilot/adapter.test.ts`

**Changes in `interactive-command-runner.ts`**:

Replace the `write` method body:
```typescript
write(text: string): void {
  if (!child.stdin || child.killed || child.stdin.destroyed) {
    throw new Error(
      'Cannot write to process: stdin is unavailable or process has exited'
    );
  }
  child.stdin.write(text + '\n');
},
```

**Changes in `adapter.ts`** — inside `sendMessage`'s `new Promise<void>(...)` constructor, wrap the `entry.runner.write(text)` call:
```typescript
try {
  entry.runner.write(text);
} catch (writeErr) {
  entry.responseState = null;
  reject(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
  return;
}
state.maxTimer = setTimeout(state.settle, MAX_RESPONSE_MS);
```
(Move `state.maxTimer` assignment inside the success path, after the `write` call.)

**Unit tests — `interactive-command-runner.test.ts`** (new file, Vitest node environment):
- **Test A**: Spawn `node -e "process.exit(0)"`, wait for exit, then call `.write('hello')` — expect it to throw with a message matching `/stdin.*unavailable|process.*exited/i`.
- **Test B**: Calling `.close()` then `.write('hi')` on a live process also throws.

**Unit tests — `adapter.test.ts`**:
- **Test C**: Inject a session entry whose `runner.write` throws `new Error('dead')`. Call `sendMessage`. Assert the returned Promise rejects with the write error.
- **Test D**: After the rejection in Test C, assert that `entry.responseState` is `null` (access via `injectEntry` / cast).

**Acceptance criteria**:
- [ ] `write()` throws when the child process has exited.
- [ ] `sendMessage` rejects immediately when `write()` throws.
- [ ] The session is not left stuck in a "busy" state after a write error.
- [ ] `npm test` passes.

---

## T04 — Post-ready write delay (Bug #2C)

**Plan reference**: Phase 4
**Dependencies**: T02 (both touch timing in `sendMessage`; implement T02 first)

**Files**:
- `src/infrastructure/copilot/adapter.ts`
- `tests/infrastructure/copilot/adapter.test.ts`

**Changes**:

1. Add constant near the top of `adapter.ts`, alongside `IDLE_TIMEOUT_MS`:
   ```typescript
   const POST_READY_DELAY_MS = 50;
   ```
2. In `sendMessage`, inside the lazy-init block, after `await this.waitForReady(sessionId)`, add:
   ```typescript
   await this.waitForReady(sessionId);
   await new Promise<void>(r => setTimeout(r, POST_READY_DELAY_MS));
   ```
   Do **not** add this delay in `startNewSession`.

**Unit test** — add one case to the existing lazy-resume test in `adapter.test.ts`:

- Use `vi.useFakeTimers()`.
- Set up the lazy factory to emit the ready prompt via `Promise.resolve().then(...)`.
- Start `sendMessage(...)`.
- Flush microtasks until `waitForReady` resolves.
- Assert `runner.write` has **not** been called yet.
- Advance timers by `POST_READY_DELAY_MS` ms.
- Flush microtasks again.
- Assert `runner.write` has now been called.

**Acceptance criteria**:
- [ ] `write()` is not called synchronously after `waitForReady()` resolves in the lazy-init path.
- [ ] Existing lazy resume tests pass (advance fake timers past `POST_READY_DELAY_MS`).
- [ ] `npm test` passes.

---

## T05 — E2E validation

**Plan reference**: Phase 6
**Dependencies**: T01–T04
**Requires**: `COPILOT_AUTHENTICATED=1` environment variable and a machine with Copilot CLI installed and authenticated.

**Files**:
- `tests/e2e/session.e2e.ts` — create if it does not exist; add if it does
- `tests/e2e/agent-execution.e2e.ts` — create if it does not exist; add if it does

**Session listing test** (covers Bug #1):
- Launch the Electron app against a workspace directory that has at least one existing Copilot session.
- Assert that the session sidebar contains at least one item (not empty).

**Message sending test** (covers Bug #2):
- Launch the app, open (or start) a session.
- Send a short message (e.g. `"hello"`).
- Assert that a non-empty response appears in the chat panel within 30 seconds.
- Gate with `COPILOT_AUTHENTICATED=1`.

**Acceptance criteria**:
- [ ] `COPILOT_AUTHENTICATED=1 npm run test:e2e` passes with the new tests.
- [ ] No existing E2E tests regressed.

---

## Dependency Map

```
T01 ──── independent
T02 ──── independent
T03 ──── independent
T04 ──── after T02
T05 ──── after T01, T02, T03, T04
```

## Validation Order

Run in this sequence before marking any task complete:

| Step | Command |
|------|---------|
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit / integration | `npm test` |
| E2E | `COPILOT_AUTHENTICATED=1 npm run test:e2e` |
