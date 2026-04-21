# Tasks: Copilot CLI Integration Fix

## Status

- **Created**: 2026-04-14
- **Status**: Draft
- **Author**: Architect
- **Scope**: Redesign adapter.ts session lifecycle, ChatService state, and IPC cleanup

## Pre-implementation Requirement (Blocker)

**Before writing any code**, the Coder must perform the following manual CLI observation
steps. These determine whether `PROMPT_PATTERN` is correct. Zero code changes should happen
until this is done.

1. Open a terminal and run:
   ```
   copilot --agent=strategist
   ```
   Observe exactly what string the CLI prints when it is waiting for input. Copy the exact
   prompt characters (e.g., `> `, `? `, `copilot> `). Note whether ANSI color codes appear.

2. Run:
   ```
   copilot --resume=<any-existing-session-id>
   ```
   Observe: (a) does it print prior conversation history to stdout on startup? (b) what
   does it print after the history (or on startup with no history) to signal readiness?

3. Record your findings as a comment at the top of the `PROMPT_PATTERN` constant in
   `adapter.ts`. Do not guess — if the prompt is different from `/[>?]\s*$/`, update the
   constant before writing any other code. If no prompt is emitted at all, remove the
   primary detection path and rely entirely on the idle-timer fallback.

---

## Phase 1: Adapter Refactor

### T1. Add runner factory injection and `activeSessions` map to `CopilotCliAdapter`

**Plan reference**: Architecture — State Model

**Files affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**:

Add infrastructure for the stateful adapter. Do NOT change any existing method behavior yet.

Changes:
- Define `SessionEntry` and `ResponseState` interfaces near the top of the file (after
  imports, before `CopilotCliAdapter`)
- Add `private activeSessions = new Map<string, SessionEntry>()` as a class field
- Add `private readonly runnerFactory` parameter to the constructor with default value
  `createInteractiveCommandRunner`
- Add five named constants before the class declaration:
  ```typescript
  const PROMPT_PATTERN = /(?:^|\n)\s*[>?]\s*$/;  // UPDATE after manual CLI observation
  const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
  const IDLE_TIMEOUT_MS  = 5_000;
  const MAX_RESPONSE_MS  = 120_000;
  const READY_TIMEOUT_MS = 15_000;
  ```

Do not modify `startNewSession`, `sendMessage`, or any other existing method.

**Acceptance criteria**:
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- All existing unit tests pass (`npm test`)

---

### T2. Implement prompt detection helpers and `waitForReady`

**Plan reference**: Architecture — Prompt Detection, `waitForReady` Helper

**Files affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**:

Add three private methods to `CopilotCliAdapter`:

```typescript
private stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '');
}

private hasPrompt(buffer: string): boolean {
  return PROMPT_PATTERN.test(this.stripAnsi(buffer));
}

private waitForReady(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    const entry = this.activeSessions.get(sessionId);
    if (!entry || entry.isReady) { resolve(); return; }
    const timeout = setTimeout(() => {
      console.warn(
        `[CopilotCliAdapter] waitForReady: prompt not detected within ${READY_TIMEOUT_MS}ms ` +
        `for session ${sessionId} — proceeding anyway`
      );
      resolve();
    }, READY_TIMEOUT_MS);
    entry.pendingReady.push(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
```

**Acceptance criteria**:
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- Unit tests added in T8 pass

---

### T3. Redesign `startNewSession` to keep the process alive

**Plan reference**: Architecture — `startNewSession` Redesign

**Files affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**:

Replace the entire body of `startNewSession`. The external signature
`(workspacePath: string): Promise<Session>` is unchanged.

New implementation steps:

1. Resolve `sessionsDir` (unchanged)
2. Snapshot `before` directory list (unchanged)
3. Allocate `entry: SessionEntry = { runner: undefined!, workspacePath, isReady: false,
   pendingReady: [], responseState: null }` — runner assigned in step 4
4. Build a stable `onData` router:
   ```typescript
   const onData = (chunk: string): void => {
     if (entry.responseState) {
       entry.responseState.onData(chunk);
     }
     // else: discard (startup replay or idle between messages)
   };
   ```
5. Build startup buffer logic (runs inside the above `onData` before `isReady` is set):
   During startup, accumulate in a local `startupBuffer`. On each chunk, append to
   `startupBuffer`. If `this.hasPrompt(startupBuffer)`, set `entry.isReady = true`, drain
   `entry.pendingReady`, and stop running the startup buffer check (ready signal fires once).

   Simplest approach: use a `boolean startupDone = false` closure. When chunk arrives:
   - if `!startupDone`: append to `startupBuffer`, check `hasPrompt`; if true set
     `startupDone = true`, set `entry.isReady = true`, flush `pendingReady`; return
   - if `startupDone`: route to `responseState` (already handled by the stable `onData`
     router above)

6. Build `onExit` handler:
   - Log error if exit code is non-zero
   - If `entry.responseState !== null`: call `entry.responseState.reject(new Error(...))`
   - Remove from `activeSessions`

7. Spawn: `entry.runner = this.runnerFactory('copilot', ['--agent=strategist'], workspacePath, onData, onExit)`

8. Store `entry` in `activeSessions` (using a placeholder key initially; update with real ID
   once directory is found). Alternatively: store after ID is known. Simplest: store after
   step 10.

9. Poll for new session directory (500 ms × 20 — unchanged logic)

10. If `!newId`: `entry.runner.close()` → throw (same error message as today)

11. If `newId`: `this.activeSessions.set(newId, entry)`

12. `await this.waitForReady(newId)` — waits for prompt detection or `READY_TIMEOUT_MS`

13. Return `{ id: newId, title: ..., workspacePath, createdAt: ... }` (same shape as today)

**Do NOT call `runner.close()` at the end** — the process must stay alive.

**Acceptance criteria**:
- `startNewSession` returns a `Session` with a valid `id`
- The runner remains in `activeSessions` after the call returns
- `runner.close()` is NOT called during the method
- `npm run typecheck` exits 0
- Existing mock-based unit tests still pass (some will require updating due to the new
  signature — see T9)

---

### T4. Redesign `sendMessage` to write to the live process

**Plan reference**: Architecture — `sendMessage` Redesign

**Files affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**:

Replace the entire body of `sendMessage`. The external signature
`(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void>` is
unchanged.

New implementation steps:

1. **Lazy resume**: if `sessionId` is not in `activeSessions`:
   - Resolve `cwd` using existing `_resolveSessionCwd`
   - Allocate a new `SessionEntry` with `isReady: false`
   - Build the same startup buffer + stable `onData` router as T3 step 4–6
   - Spawn `this.runnerFactory('copilot', ['--resume', sessionId], cwd, onData, onExit)`
   - Store entry: `this.activeSessions.set(sessionId, entry)`
   - `await this.waitForReady(sessionId)`
   - All startup output is discarded (not forwarded to the caller's `onData`)

2. `const entry = this.activeSessions.get(sessionId)!`

3. **Busy guard**: if `entry.responseState !== null`, return
   `Promise.reject(new Error('Session is busy — a previous message is still in flight'))`

4. Return a `new Promise<void>((resolve, reject) => {`:

5. Create `ResponseState`:
   ```
   state = { onData: callerOnData, resolve, reject,
             idleTimer: undefined, maxTimer: undefined,
             buffer: '', hasContent: false }
   ```
   where `callerOnData` is the `onData` parameter passed to `sendMessage`, and inside it:
   - Appends each chunk to `state.buffer`
   - Calls the caller's `onData(chunk)` for streaming
   - Sets `state.hasContent = true`
   - Calls `settle()` if `this.hasPrompt(state.buffer)`
   - Restarts idle timer if `state.hasContent`

6. Assign `entry.responseState = state`

7. Write message: `entry.runner.write(text)` — **no delay**

8. Set `state.maxTimer = setTimeout(settle, MAX_RESPONSE_MS)`

9. `settle()`:
   - If already resolved, return (guard)
   - Clear `state.idleTimer` and `state.maxTimer`
   - `entry.responseState = null`
   - `resolve()`

The `onData` router installed in T3/step-4 of lazy resume automatically routes chunks to
`entry.responseState.onData(chunk)` once `responseState` is set, so no additional wiring is
needed here.

**Remove the `createInteractiveCommandRunner` call that existed in the old `sendMessage`**.
The old runner-per-message pattern is gone entirely.

**Acceptance criteria**:
- Sending a message to an in-map session writes to stdin without spawning a new process
- Sending a message to a not-in-map session spawns via `--resume`, waits for ready, then sends
- `onData` is not called with startup/history text
- After the response settles, `entry.responseState` is `null`
- A second message can be sent after the first settles
- Sending while busy rejects immediately
- `npm run typecheck` exits 0

---

### T5. Implement `closeSession` and `closeAll`

**Plan reference**: Architecture — Lifecycle Methods

**Files affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**:

Add two public methods:

```typescript
closeSession(sessionId: string): void {
  const entry = this.activeSessions.get(sessionId);
  if (!entry) return;
  entry.runner.close();
  this.activeSessions.delete(sessionId);
}

closeAll(): void {
  for (const id of [...this.activeSessions.keys()]) {
    this.closeSession(id);
  }
}
```

**Acceptance criteria**:
- `closeSession` calls `runner.close()` and removes the entry
- `closeSession` on an unknown ID is a no-op (no throw)
- `closeAll` terminates all active runners
- `npm run typecheck` exits 0

---

## Phase 2: ChatService and IPC Wiring

### T6. Add `closeSession` and `closeAll` to `ChatService`

**Plan reference**: Phase 2

**Files affected**:
- `src/main/chat-service.ts`

**Description**:

Add two methods that delegate to the adapter:

```typescript
closeSession(sessionId: string): void {
  this.copilot.closeSession(sessionId);
}

closeAll(): void {
  this.copilot.closeAll();
}
```

No logic beyond delegation.

**Acceptance criteria**:
- Methods exist and compile
- `npm run typecheck` exits 0

---

### T7. Add `before-quit` cleanup and `close-session` IPC

**Plan reference**: Architecture — `index.ts` and `ipc.ts` Changes

**Files affected**:
- `src/shared/ipc.ts`
- `src/main/index.ts`

**Description**:

In `src/shared/ipc.ts`, add to `IPC_CHANNELS`:
```typescript
closeSession: 'agentflow:close-session',
```

In `src/main/index.ts`:

1. After the `app.whenReady()` block (or inside it, after `chatService` is instantiated),
   add:
   ```typescript
   app.on('before-quit', () => chatService.closeAll());
   ```

2. Add a new IPC handler alongside the existing chat handlers:
   ```typescript
   ipcMain.handle(IPC_CHANNELS.closeSession, (_event, sessionId: unknown) => {
     if (typeof sessionId !== 'string' || sessionId.trim() === '') return;
     chatService.closeSession(sessionId);
   });
   ```

**Acceptance criteria**:
- `IPC_CHANNELS.closeSession` is defined
- `chatService.closeAll()` is called when the app is about to quit
- `close-session` IPC handler validates input and delegates
- `npm run typecheck` exits 0

---

## Phase 3: Unit Tests

### T8. Unit test: `stripAnsi` and `hasPrompt`

**Plan reference**: Phase 3

**Files affected**:
- `tests/infrastructure/copilot/adapter.test.ts`

**Description**:

These test private helpers indirectly through `sendMessage` in T10, but they can also be
tested directly if the Coder extracts them as module-level functions (preferred) rather than
private methods. If they remain private, test through integration in T10.

If extracted as module-level helpers (`export for testing` pattern or just top-level
unexported functions accessed via the test's import chain):

Test cases:
- `stripAnsi('hello \x1b[32mworld\x1b[0m')` → `'hello world'`
- `stripAnsi('\x1b[2J\x1b[H')` → `''`
- `hasPrompt('some text\n> ')` → `true`
- `hasPrompt('some text\n? ')` → `true`
- `hasPrompt('some text > middle')` → `false` (prompt not at end)
- `hasPrompt('')` → `false`
- `hasPrompt('\x1b[32m> \x1b[0m')` → `true` (ANSI-wrapped prompt)

**Acceptance criteria**:
- All cases pass
- `npm test` exits 0

---

### T9. Unit test: `startNewSession` stores runner, returns Session, does not kill process

**Plan reference**: Phase 3

**Files affected**:
- `tests/infrastructure/copilot/adapter.test.ts`

**Description**:

Use a mock `runnerFactory` that returns a controllable fake runner. The fake runner:
- Emits `> ` (prompt) on stdout after a short delay (via `setTimeout(onData, 20)`)
- Never calls `onExit` during the test

Mock `fs.readdir` to simulate a new session directory appearing.

Test cases:
1. `startNewSession` resolves with a `Session` whose `id` matches the fake directory name
2. After `startNewSession` resolves, `adapter.activeSessions` (accessed via a test-only
   accessor or by calling `closeSession` successfully) contains the session ID
3. The mock runner's `close()` is NOT called during `startNewSession`

**Acceptance criteria**:
- All cases pass in isolation (no real CLI)
- `npm test` exits 0

---

### T10. Unit test: `sendMessage` — prompt detection, idle fallback, lazy resume, busy guard

**Plan reference**: Phase 3

**Files affected**:
- `tests/infrastructure/copilot/adapter.test.ts`

**Description**:

Use mock runner factory. Seed `activeSessions` by calling `startNewSession` on the adapter
with the mock runner (from T9 setup), or inject the entry directly via a test helper.

Test cases:

1. **Prompt detection settles the response**: seed an active session; call `sendMessage`
   with a mock `onData`; have the mock runner emit chunks followed by `\n> `; assert
   `sendMessage` resolves and `onData` was called with the content chunks.

2. **Idle timer fires when no prompt is detected**: seed an active session; call
   `sendMessage`; have runner emit one chunk, then go silent; assert `sendMessage` resolves
   after `IDLE_TIMEOUT_MS` (use fake timers via `vi.useFakeTimers()`).

3. **Dead process rejects in-flight message**: seed an active session; call `sendMessage`;
   have the mock runner call `onExit` with code 1 before any chunk; assert `sendMessage`
   rejects with an error.

4. **Lazy resume**: start with empty `activeSessions`; call `sendMessage(someId, 'hi',
   onData)`; mock runner factory emits `> ` during startup and a content chunk + `> ` for
   the response; assert `sendMessage` resolves and `onData` received the content chunk.

5. **Busy guard**: seed an active session with `responseState` non-null (manually inject);
   assert `sendMessage` rejects immediately with the "session busy" message.

**Acceptance criteria**:
- All 5 cases pass
- No test uses the real CLI
- `npm test` exits 0

---

### T11. Unit test: `closeSession` and `closeAll`

**Plan reference**: Phase 3

**Files affected**:
- `tests/infrastructure/copilot/adapter.test.ts`

**Description**:

Test cases:
1. `closeSession` calls `runner.close()` and the session is no longer in `activeSessions`
2. `closeSession` with an unknown ID does not throw
3. `closeAll` calls `close()` on all seeded runners and `activeSessions` is empty afterward

**Acceptance criteria**:
- All 3 cases pass
- `npm test` exits 0

---

## Phase 4: E2E Test and Validation

### T12. Write `tests/e2e/chat-session.e2e.ts`

**Plan reference**: Architecture — E2E Test Specification

**Files affected**:
- `tests/e2e/chat-session.e2e.ts`

**Description**:

Create a new E2E file. Use the same shell structure as `startup.e2e.ts`.

```typescript
import { test, expect, _electron as electron } from '@playwright/test';
import { join }   from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const appPath = join(process.cwd(), 'out/main/index.js');

test.describe('Chat session', () => {

  test('startNewSession creates session directory and sendMessage returns a response', async () => {
    test.skip(
      process.env.COPILOT_AUTHENTICATED !== '1',
      'Skipped: set COPILOT_AUTHENTICATED=1. Requires Copilot CLI installed and logged in.'
    );

    const tempWorkspace = join(tmpdir(), `agentflow-e2e-${randomUUID()}`);
    require('node:fs').mkdirSync(tempWorkspace, { recursive: true });

    const app = await electron.launch({ args: [appPath] });
    const chatOutput: string[] = [];
    let unsubscribe: (() => void) | undefined;

    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Start a new session
      const result = await window.evaluate(
        (workspacePath) => (window as any).agentflow.startNewSession(workspacePath),
        tempWorkspace
      );

      expect(result).toHaveProperty('session');
      const sessionId: string = result.session.id;
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      // Assert session directory was created
      const sessionDir = join(homedir(), '.copilot', 'session-state', sessionId);
      expect(existsSync(sessionDir)).toBe(true);

      // Subscribe to chatOutput events, then send a message
      unsubscribe = await window.evaluate(() =>
        (window as any).agentflow.onChatOutput((chunk: string) => {
          (window as any).__e2eChunks = (window as any).__e2eChunks ?? [];
          (window as any).__e2eChunks.push(chunk);
        })
      );

      await window.evaluate(
        ([sid, msg]) => (window as any).agentflow.sendMessage(sid, msg),
        [sessionId, 'hi']
      );

      const chunks: string[] = await window.evaluate(
        () => (window as any).__e2eChunks ?? []
      );

      expect(chunks.join('')).toBeTruthy(); // non-empty response

      // Clean up session process
      await window.evaluate(
        (sid) => (window as any).agentflow.closeSession?.(sid),
        sessionId
      );

    } finally {
      await app.close();
      try { rmSync(tempWorkspace, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

});
```

**Notes**:
- The `onChatOutput` → `__e2eChunks` pattern stores chunks in the window context so they
  can be retrieved synchronously after `sendMessage` resolves.
- `closeSession` is called with optional chaining (`?.`) because the IPC channel is added
  in T7 and may not be present in older builds.
- The test has a 120-second ceiling due to `MAX_RESPONSE_MS`. Playwright's default test
  timeout may need increasing in `playwright.config.ts` for this test — check the current
  configured timeout and raise it to at least 150 seconds for this describe block if needed.

**Acceptance criteria**:
- Test is skipped when `COPILOT_AUTHENTICATED` is not set
- Test passes with `COPILOT_AUTHENTICATED=1` on a machine with the CLI installed and
  authenticated
- Session directory exists on disk after `startNewSession`
- Response chunks are non-empty

---

### T13. Run the full validation suite

**Plan reference**: Phase 4 — Validation

**Dependencies**: T1 – T12 all complete

**Description**:

Run these commands in order. All must exit 0.

```
npm run typecheck
npm run lint
npm test
npm run build
COPILOT_AUTHENTICATED=1 npm run test:e2e
```

If any step fails, fix the failure before marking this task complete. Do not skip or comment
out failing tests.

**Acceptance criteria**:
- All five commands exit 0
- `chat-session.e2e.ts` runs and passes (or is correctly skipped when gate is not set)
- No regressions in `startup.e2e.ts` or any existing unit/integration tests

---

## Suggested Delivery Sequence

```
T1 → T2          (state model + helpers; no behavior change, fast)
T3               (startNewSession redesign — largest change)
T4               (sendMessage redesign — second largest)
T5               (cleanup methods — short)
T6 → T7          (wiring — short)
T8 → T11         (unit tests — can overlap with T3–T5 development)
T12 → T13        (E2E + full validation — last)
```

T8–T11 should be written alongside T3–T5 rather than after. Write the test first if a
TDD approach is preferred — the mock runner factory makes this straightforward.

---

## Out-of-Scope Reminder

Do not implement any of the following as part of this fix:

- Changes to `openSession` (events.jsonl read path)
- Changes to `listSessions`
- Auth or login changes
- Renderer-side ANSI stripping or markdown rendering of responses
- Agent switching or multi-agent session handling
- Concurrent multi-message support within one session
