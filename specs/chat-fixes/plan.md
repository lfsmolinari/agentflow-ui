# Implementation Plan: Chat Fixes

## Scope

Targeted fixes in two files only. No architectural changes. No new npm dependencies.

- `src/infrastructure/copilot/adapter.ts`
- `src/infrastructure/system/interactive-command-runner.ts`

---

## Bug #1 — Path Normalization in `listSessions`

### Problem

`e.cwd === workspacePath` is an exact string comparison. On macOS, `events.jsonl`
stores the real path (e.g. `/private/var/folders/...`) while the workspace service
may have stored a symlink (`/var/folders/...`). Trailing slashes also differ.
Result: the filter silently drops all sessions.

### Decision

Introduce a module-level sync helper before the class:

```typescript
import { realpathSync } from 'node:fs';        // add to imports

function normalizePath(p: string): string {
  try { return realpathSync(p); } catch { return path.resolve(p); }
}
```

In `listSessions`:

1. Normalize `workspacePath` **once** before the loop: `const normalizedCwd = normalizePath(workspacePath);`
2. Replace the filter: `normalizePath(e.cwd) === normalizedCwd`
3. Keep the original `workspacePath` (not normalized) in `sessions.push(...)` — return what the caller passed in.

**Why `realpathSync` (sync)?**
Resolves symlinks, which are the root cause on macOS. Sync avoids adding `await`
points inside the JSONL-parsing loop. The `path.resolve` fallback covers paths that
do not exist on disk (CI fixtures, newly created workspaces) without throwing.

**Why not `fs.realpath` (async)?**
Would require an extra `await` per event per session, or a `Promise.all` around
the inner loop. The added complexity doesn't justify the benefit — local path
resolution is fast.

---

## Bug #2A — Permissive Prompt Pattern

### Problem

`PROMPT_PATTERN = /(?:^|\r?\n)[\s\S]{0,50}[>?]\s*$/m` silently fails when the
Copilot CLI prefixes the prompt with a context string longer than 50 characters
(e.g. session ID, agent name, workspace name). The 50-character cap causes
`hasPrompt()` to return `false` on valid prompts, so `waitForReady()` waits for
the full `READY_TIMEOUT_MS` (15 s) before falling through.

### Decision

Change the cap from 50 to 200:

```typescript
const PROMPT_PATTERN = /(?:^|\r?\n)[\s\S]{0,200}[>?]\s*$/m;
```

**Why 200 and not unlimited?**
Unlimited `[\s\S]*` invites catastrophic backtracking when accumulating large
response buffers. 200 is generous for any realistic CLI prompt prefix while
remaining safe. `[\s\S]` (dotall) is intentionally preserved over `[^\n]` to
handle CRLF-embedded prefixes without behavioral regression on Windows.

**ANSI stripping**: already applied in `hasPrompt()` before the pattern runs — no
change needed there.

---

## Bug #2B — `write()` Error Propagation

### Problem

`interactive-command-runner.ts` `write()` silently ignores writes when the process
is dead (`child.killed` or `child.stdin` unavailable). The caller (`sendMessage`)
cannot detect the failure; the message is lost and the in-flight Promise hangs
until `MAX_RESPONSE_MS` (120 s).

### Decision

**In `interactive-command-runner.ts`**, make `write()` throw when the process is
not writable:

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

**In `adapter.ts`** (`sendMessage`, inside the Promise constructor), wrap the
`entry.runner.write(text)` call:

```typescript
try {
  entry.runner.write(text);
} catch (writeErr) {
  entry.responseState = null;    // prevent "busy" lock-out on the session
  reject(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
  return;
}
```

**Why clean up `responseState`?**
`responseState` is assigned before `write()` is called. Without cleanup, a write
error leaves `responseState` non-null, so every subsequent `sendMessage` call
rejects with "busy" — the session becomes permanently stuck.

**Why throw instead of returning a boolean?**
A boolean would require every caller to check the return value. Throwing aligns
with the fail-fast coding principle and propagates cleanly into the existing
Promise-based error flow.

---

## Bug #2C — Post-Ready Write Guard

### Problem

`waitForReady()` resolves either on prompt detection (Bug #2A) or on the 15 s
fallback timeout. In the lazy-init path of `sendMessage`, `write(text)` is called
immediately after `waitForReady()` resolves. If `waitForReady` resolved via timeout
(before stdin was fully initialized), the write may be lost.

### Decision

Add a `POST_READY_DELAY_MS = 50` constant and insert a one-shot delay after
`waitForReady()` in the lazy-init block of `sendMessage` only:

```typescript
await this.waitForReady(sessionId);
await new Promise<void>(r => setTimeout(r, POST_READY_DELAY_MS));
```

**Scope**: lazy-init path in `sendMessage` only. `startNewSession` does not write;
adding the delay there would impose latency on session creation with no benefit.

**Why 50 ms?** Imperceptible to users, sufficient to let Node flush the write queue
for stdin after the process signals readiness. This is a belt-and-suspenders guard;
Bug #2A (prompt pattern fix) is the primary fix — T04 adds robustness when the
prompt isn't detected correctly.

---

## Phase Plan

| Phase | Change | Files | Independent? |
|-------|--------|-------|-------------|
| 1 | Path normalization helper + updated filter | `adapter.ts` | Yes |
| 2 | `PROMPT_PATTERN` `{0,50}` → `{0,200}` | `adapter.ts` | Yes |
| 3 | `write()` throws + `sendMessage` cleanup | `interactive-command-runner.ts`, `adapter.ts` | Yes |
| 4 | `POST_READY_DELAY_MS` in lazy-init | `adapter.ts` | After Phase 2 |
| 5 | Unit tests for all four changes | `adapter.test.ts`, new `interactive-command-runner.test.ts` | After 1–4 |
| 6 | E2E validation (`session.e2e.ts`, `agent-execution.e2e.ts`) | `tests/e2e/` | After 5, requires `COPILOT_AUTHENTICATED=1` |

Phases 1, 2, and 3 are fully independent. Phase 4 should follow Phase 2 (both touch
the same timing path). Phase 5 must follow all code changes.
