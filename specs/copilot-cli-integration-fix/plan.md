# Implementation Plan: Copilot CLI Integration Fix

## Status

- **Created**: 2026-04-14
- **Status**: Draft
- **Author**: Architect
- **Scope**: Redesign adapter.ts session lifecycle, ChatService state, and IPC cleanup

---

## Analysis: Findings

### Finding 1 — Root cause of the broken implementation

`sendMessage` in the current adapter spawns a brand-new `copilot --resume=<id>` process for
every single message. When that process starts, the CLI replays the entire prior conversation
history to stdout before it is ready to accept input. Because the existing `onData` callback
forwards every chunk directly to the UI, the user sees the full history of prior turns
instead of (or prepended to) the actual new response.

Additionally, the message itself is only sent after a fixed 2-second delay — a guess at how
long the process needs to start up. There is no signal confirming the process is ready. If
startup takes longer, the message is silently dropped.

### Finding 2 — Idle timer is structurally insufficient

The 10-second idle timer fires whenever stdout goes quiet for 10 consecutive seconds. LLM
responses routinely pause mid-generation. If the pause falls inside a 10-second window, the
response is cut short and the session is closed prematurely. Extending the timer trades one
problem for another (slow UX recovery). The correct signal is the CLI's re-display of its
input prompt — the character sequence the CLI emits when it is waiting for the next message.

### Finding 3 — No process lifecycle management exists

`CopilotCliAdapter` is currently stateless. Every call allocates and discards its own
runner. This means there is no mechanism to:
- reuse an open process when the next message arrives
- kill processes when the session is closed or the app quits
- detect that a process died mid-session

Any orphaned `copilot` process from a timed-out `sendMessage` call continues running until
the app exits.

### Finding 4 — CLI flags and invocation modes (from adapter.ts docs)

The comments in `adapter.ts` (confirmed against official documentation) establish:
- New session: `copilot --agent=strategist` with cwd = workspace folder
- Resume session: `copilot --resume=<session-id>`
- Single-turn mode: `copilot -p "PROMPT"` — exits after one response, **cannot stream**
- Interactive mode: keeps process alive, reads stdin, streams stdout

Single-turn mode is incompatible with FR6 (streaming) from the Milestone 2 spec. Interactive
mode is the only viable path.

---

## Chosen Approach: Option A — Long-lived process per session

### Why not Option B (single-turn `-p`)

The Milestone 2 spec (FR6) requires streaming output to the UI as chunks arrive. The
`adapter.ts` docs confirm: "`copilot -p` exits after one response and cannot stream." Ruling
out Option B entirely.

### Why not Option C (resume with history skip)

Option C requires knowing the exact CLI output format on `--resume` and detecting a reliable
end-of-history delimiter. This is brittle: any CLI version update that changes the history
replay format silently breaks output matching. It also inherits the root structure of
spawning a new process per message, which is the direct cause of the streaming failure.

### Why Option A works

Option A (long-lived process) eliminates both root problems:

- **History replay** is never an issue because the process is already at the current turn.
  There is no `--resume` spawn mid-conversation.
- **Prompt detection** replaces the idle timer as the primary end-of-response signal,
  removing the structural fragility of time-based response bounding.

The added complexity — a `Map` of active runners and a process lifecycle — is minimal and
justified. It matches how every interactive CLI-hosting application (terminals, REPLs, IDE
debuggers) manages child processes.

---

## In Scope

- `src/infrastructure/copilot/adapter.ts` — `startNewSession`, `sendMessage`, new lifecycle
  methods, runner factory injection
- `src/main/chat-service.ts` — `closeSession` and `closeAll` delegators
- `src/main/index.ts` — `before-quit` cleanup and optional `close-session` IPC channel
- `src/shared/ipc.ts` — add `closeSession` channel constant
- `tests/infrastructure/copilot/adapter.test.ts` — new unit tests for lifecycle
- `tests/e2e/chat-session.e2e.ts` — new E2E test for real send + receive

## Out of Scope

- `openSession` (events.jsonl read path — no change needed)
- `listSessions` (no change needed)
- Auth, login, install flows
- Renderer and preload changes
- Agent switching

---

## Architecture

### State Model

`CopilotCliAdapter` becomes stateful. It holds a private map:

```typescript
private activeSessions = new Map<string, SessionEntry>();
```

`SessionEntry` shape:

```typescript
interface SessionEntry {
  runner: InteractiveCommandRunner;
  workspacePath: string;
  isReady: boolean;
  pendingReady: Array<() => void>;   // callbacks waiting for first prompt detection
  responseState: ResponseState | null; // non-null while a message is in flight
}
```

`ResponseState` shape (created fresh per `sendMessage` call):

```typescript
interface ResponseState {
  onData: (chunk: string) => void;      // caller's streaming callback
  resolve: () => void;
  reject: (err: Error) => void;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  maxTimer: ReturnType<typeof setTimeout> | undefined;
  buffer: string;        // accumulated stdout for prompt detection (ANSI-stripped)
  hasContent: boolean;   // true after first non-empty chunk arrives
}
```

The runner factory is injected so unit tests can substitute a controllable fake:

```typescript
constructor(
  private readonly runner: CommandRunner = defaultRunner,
  private readonly runnerFactory: typeof createInteractiveCommandRunner = createInteractiveCommandRunner
) {}
```

### Named Constants

Declare at the top of `adapter.ts` (adjustable without hunting through the implementation):

```typescript
// The CLI prints this pattern when it is ready for the next message.
// MUST be verified empirically — run `copilot --agent=strategist` in a terminal
// and observe the exact prompt string. Adjust this constant to match.
const PROMPT_PATTERN = /(?:^|\n)\s*[>?]\s*$/;

const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

const IDLE_TIMEOUT_MS   = 5_000;   // idle silence after content → end of response
const MAX_RESPONSE_MS   = 120_000; // hard ceiling on a single response
const READY_TIMEOUT_MS  = 15_000;  // max wait for ready prompt after spawn
```

**Critical note to Coder**: `PROMPT_PATTERN` is the highest-risk constant in this plan.
Before implementing or running tests:

1. Run `copilot --agent=strategist` in a terminal. Observe what the CLI prints when it is
   waiting for input.
2. Run `copilot --resume=<any-session-id>` in a terminal. Observe (a) whether it replays
   history and (b) what it prints when ready for input after the replay.
3. Update `PROMPT_PATTERN` to match the observed string. Common patterns are `> `,
   `copilot> `, `? `, or no prompt at all (in which case the idle timer fallback becomes the
   sole signal).

### Prompt Detection

Two private helpers:

```typescript
private stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '');
}

private hasPrompt(buffer: string): boolean {
  return PROMPT_PATTERN.test(this.stripAnsi(buffer));
}
```

Detection strategy (in priority order):
1. **Primary**: `hasPrompt` returns true on the accumulated stdout buffer → call `settle()`
2. **Secondary fallback**: 5-second idle timer (`IDLE_TIMEOUT_MS`) restarted on every chunk,
   but only activated after `hasContent = true`
3. **Hard max**: 120-second total timer (`MAX_RESPONSE_MS`) set when the message is written
   to stdin

This multi-layer approach means the system degrades gracefully if the prompt pattern is wrong
or not present.

### `startNewSession` Redesign

Replace the current implementation with:

1. Resolve `sessionsDir` (unchanged)
2. Snapshot `before` directory list (unchanged)
3. Allocate a `SessionEntry` with `isReady = false`
4. Spawn via `this.runnerFactory('copilot', ['--agent=strategist'], workspacePath, onData, onExit)`
5. **Startup `onData` handler** (runs until first prompt is detected):
   - Accumulate text in a startup buffer
   - On each chunk, run `hasPrompt` on the ANSI-stripped buffer
   - On match: set `entry.isReady = true`, flush `entry.pendingReady`, switch to message
     routing mode (discard/buffer until a `responseState` is set)
6. **`onExit` handler**: log error; if `responseState` is non-null, call `responseState.reject`
7. Poll for new session directory (500 ms × 20 = up to 10 s) — unchanged
8. Await `waitForReady(newId)` (up to `READY_TIMEOUT_MS`; resolve with warning if timeout)
9. Store `entry` in `activeSessions`
10. Return `Session` (same shape as today)

**Do NOT call `runner.close()` at the end** — this is the key behavioral change.

### `sendMessage` Redesign

Replace the current implementation with:

1. **Ensure session is running**: if `sessionId` is not in `activeSessions`, spawn lazily:
   - Resolve `cwd` via existing `_resolveSessionCwd`
   - Spawn `copilot --resume=<sessionId>` via `runnerFactory`
   - Run startup handler (discard ALL output until `hasPrompt`)
   - Await `waitForReady`
   - Store entry
2. Get `entry` from `activeSessions`
3. **Guard**: if `entry.responseState !== null`, reject with
   `'Session is busy — a previous message is still in flight'`
4. Create `ResponseState` (zero-initialize timers and buffer)
5. Assign `entry.responseState = state`
6. **Write message**: `entry.runner.write(text)` — no delay, no timer before write
7. **In-flight `onData` handler** (called by the runner for every stdout chunk):
   - Append chunk to `state.buffer`
   - Call the caller-supplied `onData(chunk)` (for streaming to the UI)
   - Set `state.hasContent = true`
   - Run `hasPrompt(state.buffer)` → if true, call `settle()`
   - If `state.hasContent`: clear and restart idle timer
8. `settle()`: clear both timers; set `entry.responseState = null`; call `state.resolve()`
9. Set `state.maxTimer` to fire `settle()` after `MAX_RESPONSE_MS`

The routing of `onData` chunks to the active `responseState` is managed by a single router
function installed once (at spawn time) that reads `entry.responseState` on every call:

```typescript
const onData = (chunk: string): void => {
  if (entry.responseState) {
    entry.responseState.onData(chunk);
  }
  // else: discard (startup replay or idle between messages)
};
```

This keeps the runner's `onData` callback stable across the lifetime of the process.

### `waitForReady` Helper

```typescript
private waitForReady(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    const entry = this.activeSessions.get(sessionId);
    if (!entry || entry.isReady) { resolve(); return; }
    const timeout = setTimeout(() => {
      console.warn(`[CopilotCliAdapter] waitForReady: prompt not detected within ${READY_TIMEOUT_MS}ms for ${sessionId} — proceeding anyway`);
      resolve();
    }, READY_TIMEOUT_MS);
    entry.pendingReady.push(() => { clearTimeout(timeout); resolve(); });
  });
}
```

### Lifecycle Methods on `CopilotCliAdapter`

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

### `ChatService` Changes

Add two thin delegating methods:

```typescript
closeSession(sessionId: string): void {
  this.copilot.closeSession(sessionId);
}

closeAll(): void {
  this.copilot.closeAll();
}
```

### `ipc.ts` Changes

Add one constant:

```typescript
closeSession: 'agentflow:close-session',
```

### `index.ts` Changes

1. After `app.whenReady()`, add:
   ```typescript
   app.on('before-quit', () => chatService.closeAll());
   ```

2. Register a new IPC handler:
   ```typescript
   ipcMain.handle(IPC_CHANNELS.closeSession, (_event, sessionId: unknown) => {
     if (typeof sessionId !== 'string' || sessionId.trim() === '') return;
     chatService.closeSession(sessionId);
   });
   ```

---

## E2E Test Specification

**File**: `tests/e2e/chat-session.e2e.ts`
**Gate**: `COPILOT_AUTHENTICATED=1` (same pattern as `startup.e2e.ts`)

```
test('sends a message and receives a non-empty streaming response', async () => {
  test.skip(process.env.COPILOT_AUTHENTICATED !== '1', '...');

  1. Create a temp directory (os.tmpdir() + '/agentflow-e2e-' + randomUUID())
  2. Launch the Electron app
  3. Evaluate window.agentflow.startNewSession(tempDir) — capture { session }
  4. Assert: session.id is a non-empty string
  5. Assert: fs.existsSync(path.join(os.homedir(), '.copilot/session-state', session.id)) === true
  6. Collect chatOutput chunks via window.agentflow.onChatOutput(...)
  7. await window.agentflow.sendMessage(session.id, 'hi')
  8. Assert: collected chunks joined is non-empty
  9. Call window.agentflow.closeSession(session.id) if channel added
  10. Clean up: remove temp directory
});
```

---

## Phase Plan

### Phase 1: Adapter Refactor (core)

**Objective**: Replace the broken `startNewSession` + `sendMessage` with the long-lived
process model. Keep the `InteractiveCommandRunner` interface unchanged.

**Exit criteria**:
- `CopilotCliAdapter` holds `activeSessions` map
- `startNewSession` keeps the process alive and waits for ready signal
- `sendMessage` writes to the existing process and detects end via prompt / idle timer
- `closeSession` and `closeAll` kill processes and clean map
- `npm run typecheck` passes

### Phase 2: ChatService and IPC Wiring (short)

**Objective**: Wire lifecycle through `ChatService` and `index.ts`.

**Exit criteria**:
- `chatService.closeAll()` is called on `before-quit`
- `close-session` IPC is registered

### Phase 3: Unit Tests

**Objective**: All new adapter paths are unit-tested with a mock runner factory.

**Exit criteria**:
- Prompt detection helpers have dedicated tests
- `startNewSession`, `sendMessage`, `closeSession`, `closeAll` are covered
- No test depends on the real CLI

### Phase 4: E2E Test + Validation

**Objective**: Real CLI round-trip confirmed.

**Exit criteria**:
- `chat-session.e2e.ts` passes with `COPILOT_AUTHENTICATED=1`
- Full validation suite passes (`typecheck`, `lint`, `npm test`, `build`, `test:e2e`)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unknown prompt pattern | High | High | `PROMPT_PATTERN` is a named constant; idle-timer fallback always active; Coder must observe CLI manually before coding |
| CLI version change breaks prompt | Medium | Medium | `PROMPT_PATTERN` is one line to update; integration E2E catches regression |
| Process leaks on abnormal app exit | Low | Medium | `app.on('before-quit')` covers normal exit; `process.on('exit')` can be added as belt-and-suspenders if needed |
| Long response exceeds 120 s max | Low | Low | `MAX_RESPONSE_MS` is a named constant; log a warning when the max fires |
| Two messages sent before first settles | Low | Medium | "session busy" guard at step 3 of `sendMessage` |
| Resume startup takes longer than 15 s | Low | Low | `READY_TIMEOUT_MS` resolves anyway with a warning rather than rejecting |

---

## Dependency Notes

- `InteractiveCommandRunner` interface is unchanged — no changes to
  `interactive-command-runner.ts`
- The existing `_resolveSessionCwd` helper is retained for the lazy resume path in
  `sendMessage`
- `openSession` is unaffected — it still reads `events.jsonl` for transcript display

## Milestone Completion Definition

This fix is complete when:
- Sending a first message in a new session streams a real response with no history prepended
- Sending a second message in the same session streams only the new response
- Opening a prior session and sending a message uses the lazy-resume path and streams only
  the new response
- All processes are cleaned up on app quit
- The real E2E test passes with `COPILOT_AUTHENTICATED=1`
