# Implementation Plan: Milestone 2

## Status

- **Created**: 2026-04-14
- **Status**: Draft
- **Author**: Architect
- **Scope**: Workspace creation, new Strategist chat, and previous session retrieval

## Milestone Goal

Activate the core workspace and session loop of AgentFlow UI so that an authenticated user can add a local folder, see its prior Copilot CLI sessions, start a new Strategist chat, send messages, and resume earlier work — all without touching the terminal.

## Starting Point

Milestone 1 is complete. The app:

- launches with install gate, login, and an authenticated empty shell
- routes authenticated users to `AuthenticatedShell` which renders `SidebarFrame` (structurally present but empty) and `ShellEmptyState` ("Start a new project")
- exposes `window.agentflow` via the preload bridge with channels for startup, login, logout, and auth-refresh
- uses `src/shared/ipc.ts` for typed channel names and `AgentflowApi` interface
- uses `src/shared/startup-state.ts` for state types
- has a `CopilotCliAdapter` in `src/infrastructure/copilot/adapter.ts` and a `CommandRunner` in `src/infrastructure/system/command-runner.ts`

## In Scope

- Workspace folder picker (via native Electron dialog)
- Workspace persistence (JSON index in Electron userData)
- Workspace list in left rail with selection and "+" action
- Session discovery from Copilot CLI local storage
- Session list in left rail nested under active workspace
- New Strategist chat creation
- Chat surface: empty-transcript start, streaming responses, composer
- Prior session restoration with transcript loaded from CLI
- Continuation of a restored session
- All new IPC channels and preload extensions required for the above
- Unit, integration, and E2E tests per the constitution

## Out of Scope

- Agent selector in the composer
- File-path context attachment
- Workspace removal or renaming
- Session deletion
- Background session watching or push updates to the session list
- Right-side artifact panel

## Architecture Overview

Milestone 2 adds three new capability areas to the existing architecture, all of which follow the boundaries already established in M1:

```
renderer
  └── window.agentflow  (typed IPC bridge via preload)
        ├── workspace channels  (listWorkspaces, addWorkspace)
        ├── session channels    (listSessions, startNewSession, openSession)
        └── chat channels       (sendMessage, chatOutput push)
main
  ├── WorkspaceService         (reads/writes userData JSON index)
  ├── SessionService           (wraps adapter, maps CLI metadata to Session types)
  ├── ChatService              (manages CLI chat process lifecycle, streams to renderer)
  └── CopilotCliAdapter        (extended: listSessions, startNewSession, openSession, sendMessage)
infrastructure
  └── system/command-runner.ts (extended for bidirectional stdin support)
shared
  ├── ipc.ts                   (new channels + AgentflowApi extension)
  └── workspace-types.ts       (Workspace, Session, ChatMessage)
renderer
  ├── AuthenticatedShell       (extended: owns workspace/session state)
  ├── SidebarFrame             (extended: real workspace + session lists)
  ├── WorkspaceItem            (new)
  ├── SessionItem              (new)
  ├── WorkspaceEmptyState      (new — no sessions in selected workspace)
  ├── ChatView                 (new — transcript + composer)
  ├── ChatTranscript           (new)
  └── ChatComposer             (new)
```

### Electron Boundaries

No change to the boundary rules from M1:

- renderer calls only `window.agentflow.*` methods — never Node, fs, or process APIs directly
- preload exposes the extended `AgentflowApi` interface via `contextBridge`
- main process owns all dialog invocations, filesystem reads and writes, and CLI process spawning

### Workspace Persistence Strategy

Workspaces are stored as a JSON array in `app.getPath('userData')/agentflow-workspaces.json`.

Schema:

```json
[
  { "path": "/Users/alice/projects/my-app", "name": "my-app" }
]
```

The `name` field is always the `basename` of `path`. Computed at write time. Never user-editable in M2.

This file is read once on app startup (loaded during `listWorkspaces`) and updated synchronously on `addWorkspace`. It must not contain session IDs, conversation text, or auth tokens.

### Session Discovery Strategy

The CopilotCliAdapter must discover sessions stored by Copilot CLI. Sessions are stored under `~/.copilot/session-state/`, with one subdirectory per session.

**Implementation responsibility**: The `CopilotCliAdapter.listSessions(workspacePath)` method must:

1. Locate the Copilot CLI sessions directory at `~/.copilot/session-state/` (resolved via `os.homedir()`; on Windows use the `COPILOT_HOME` environment variable override if set)
2. Read the directory and filter files whose metadata indicates they belong to the given workspace path
3. Map each file to a `Session` object with `id`, `title`, and `createdAt`
4. Sort sessions by recency, most recent first

Title derivation priority:
1. Title field from session metadata if present
2. First user message content, truncated to ~60 characters
3. Formatted creation timestamp fallback

**Confirmed**: Copilot CLI stores sessions under `~/.copilot/session-state/<session-id>/events.jsonl`. Each session directory contains a JSONL event log. Key fields available per event: `sessionId`, `timestamp` (milliseconds), `cwd` (working directory when the session started), and `source`. A session title can be derived from a `/rename` event record if present; fall back to a human-formatted timestamp. On Windows, the base directory is controlled by the `COPILOT_HOME` environment variable. Discovery requires enumerating subdirectories of `~/.copilot/session-state/`, reading each `events.jsonl`, and matching the `cwd` field to the selected workspace path.

Source: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference#automatically-managed-files

### Chat Process Strategy

Copilot CLI chat requires an interactive process where the app sends user input and receives streaming output. The existing `CommandRunner` pipes stdin to `'ignore'` and is not suitable for interactive use. M2 requires:

**Option A (not selected)**: Per-message invocation

- Each send is a new `copilot chat --prompt "<message>"` (or equivalent) invocation starting from the session context
- Simpler process lifecycle; streaming output per invocation is already supported by `CommandRunner`
- Session state is owned by the CLI — each invocation implicitly picks up prior context through the session ID

**Option B**: Long-running interactive process

- Spawn `copilot chat` once; pipe stdin/stdout for the session lifetime
- Requires a new `InteractiveCommandRunner` that exposes a stdin write method alongside stdout streaming
- More complex process lifecycle and error recovery
- Preferred for latency-sensitive multi-turn UX; deferred if Option A is viable

**Decision for M2**: Option B is selected. The interactive stdin/stdout mode (`copilot --agent=strategist` with process `cwd` = workspace path, and `copilot --resume=<session-id>` to continue a prior session) is required for a true streaming multi-turn chat experience. T12a (`InteractiveCommandRunner`) is a required task in Phase 4.

**Confirmed**: `copilot -p "PROMPT"` provides a non-interactive single-turn mode, but for a streaming multi-turn chat UI, an interactive stdin/stdout session is required. **Option B is selected for M2**. T12a (`InteractiveCommandRunner`) is a required task, not conditional.

**Confirmed**: There is no `--workspace` or `--cwd` flag. New chat sessions are started by spawning `copilot --agent=strategist` with the child process `cwd` set to the workspace folder path. The CLI records the `cwd` in session metadata automatically.

Source: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#command-line-options

**Confirmed**: Prior sessions are continued by spawning `copilot --resume=<session-id>`. The most recently closed session can also be resumed with `copilot --continue`. The CLI restores the full conversation context from `events.jsonl` automatically.

Source: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli#resume-an-interactive-session

### Renderer State Architecture

Milestone 1's `App.tsx` routes to `AuthenticatedShell` when state is `authenticated`. In M2, the authenticated experience now has its own state machine. The clean separation is:

- `App.tsx`: unchanged — still routes to `AuthenticatedShell` for `authenticated` state
- `AuthenticatedShell`: owns workspace/session application state, delegates rendering to sub-components

`AuthenticatedShell` will manage:

```ts
type WorkspaceViewState =
  | { kind: 'no_workspace' }                // M1 empty shell — no workspaces yet
  | { kind: 'workspace_selected'; workspace: Workspace; sessions: Session[] | null }
  | { kind: 'active_session'; workspace: Workspace; session: Session; messages: ChatMessage[]; streaming: boolean }
```

Data fetching is driven by workspace selection events:

1. On mount: `listWorkspaces()` — if empty, show `ShellEmptyState`; if non-empty, auto-select the first workspace and call `listSessions(path)`
2. On workspace switch: call `listSessions(newWorkspace.path)`
3. On "New chat": call `startNewSession(workspace.path)`
4. On session select: call `openSession(session.id)` to load transcript
5. On send: call `sendMessage(session.id, text)`; listen to `chatOutput` push events

State transitions must be deterministic and testable in isolation via a pure reducer or hook.

## Phase Plan

### Phase 1: Shared Types and IPC Contracts

**Objective**: Define the data shapes and IPC channel names that all other phases depend on. No main-process or renderer logic yet.

**Steps**:

1. Add `src/shared/workspace-types.ts` containing `Workspace`, `Session`, `ChatMessage`
2. Extend `src/shared/ipc.ts`:
   - Add channel names: `listWorkspaces`, `addWorkspace`, `listSessions`, `startNewSession`, `openSession`, `sendMessage`, `chatOutput`
   - Extend `AgentflowApi` interface with the new method signatures
3. Extend `src/preload/index.ts` to expose the new methods via `contextBridge`

**Exit criteria**:

- TypeScript compiles with new shared types
- Preload exposes the full extended `AgentflowApi` (methods may throw "not implemented" stubs during this phase)

**Dependencies**: None — can start immediately after M1 is confirmed complete.

---

### Phase 2: Workspace Service and IPC Handlers

**Objective**: Implement workspace persistence and wire the `listWorkspaces` and `addWorkspace` IPC handlers.

**Steps**:

1. Create `src/main/workspace-service.ts`:
   - `load(): Promise<Workspace[]>` — reads and parses `agentflow-workspaces.json`; returns empty array if file missing
   - `save(workspaces: Workspace[]): Promise<void>` — writes the JSON file
   - `add(folderPath: string): Promise<Workspace[]>` — deduplicates, appends, saves, returns updated list
2. Register `listWorkspaces` IPC handler in `src/main/index.ts`:
   - calls `workspaceService.load()`
3. Register `addWorkspace` IPC handler in `src/main/index.ts`:
   - calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`
   - if the user cancels, return the existing workspace list unchanged
   - if a folder is selected, call `workspaceService.add(path)` and return the updated list
4. Validate the folder path in the IPC handler before passing to the service (must be a non-empty string)

**Exit criteria**:

- `listWorkspaces` returns `[]` on first run and the saved list on subsequent runs
- `addWorkspace` opens the native dialog, persists the path, and returns the updated list
- Dialog cancellation returns the unchanged workspace list
- Unit tests pass for `WorkspaceService` CRUD operations

**Dependencies**: Phase 1 (shared types and IPC channel names)

---

### Phase 3: Session Discovery

**Objective**: Implement session discovery via Copilot CLI storage and wire the `listSessions` IPC handler.

**Steps**:

1. **Validation task**: Confirm on the live CLI that `~/.copilot/session-state/` exists and contains the expected `<session-id>/events.jsonl` structure. Document findings in a comment block at the top of the adapter extension. The path and JSONL format are already confirmed per official documentation (see Session Discovery Strategy); this step validates the live environment before adapter code is written.
2. Extend `CopilotCliAdapter`:
   - Add `listSessions(workspacePath: string): Promise<Session[]>`:
     - resolves the sessions directory path using `os.homedir()` and platform-appropriate file system paths
     - reads all session files in the directory
     - filters by workspace path match
     - maps to `Session` type with title derivation (metadata title → first user message → timestamp fallback)
     - returns sorted by recency, most recent first
3. Create `src/main/session-service.ts`:
   - `listSessions(workspacePath)`: delegates to the adapter and handles errors
4. Register `listSessions` IPC handler in `src/main/index.ts`
5. Add fixture-based tests for the session parsing and filtering logic

**Exit criteria**:

- `listSessions` returns a typed session array for a workspace that has CLI sessions
- `listSessions` returns an empty array for a workspace with no sessions
- `listSessions` does not throw when the CLI sessions directory is absent (returns empty array)
- Unit tests for session file parsing pass against fixture data

**Dependencies**: Phase 1 (shared types); the validation in step 1 should precede steps 2–5 but T07 may proceed in parallel once T06 starts (the documented path is already known).

---

### Phase 4: Chat Infrastructure

**Objective**: Implement the mechanism for starting new sessions, loading prior session transcripts, and sending messages with streaming responses.

**Steps**:

1. **Validation task**: Confirm the interactive CLI behaviour with the live binary — spawn `copilot --agent=strategist` in a test directory, verify stdin/stdout piping, and confirm `copilot --resume=<session-id>` resumes a session. The invocation contract is already confirmed per official documentation (see Chat Process Strategy). Document the output format (stream start/end signals) in adapter comments.
2. Extend `CopilotCliAdapter`:
   - `startNewSession(workspacePath: string): Promise<Session>` — invokes the CLI to create a session; returns the new session's metadata (id and initial title)
   - `openSession(sessionId: string): Promise<ChatMessage[]>` — loads the transcript for a prior session; returns prior turns as `ChatMessage[]`
   - `sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void>` — sends a message and streams the response using Option B (interactive runner via `InteractiveCommandRunner`)
3. Create `src/infrastructure/system/interactive-command-runner.ts` with support for stdin writes and stdout streaming on a persistent child process (required for Option B, which is selected for M2)
4. Create `src/main/chat-service.ts`:
   - `startNewSession(workspacePath)`: delegates to adapter; handles errors
   - `openSession(sessionId)`: delegates to adapter; handles errors
   - `sendMessage(sessionId, text, onData)`: delegates to adapter; handles errors
5. Register IPC handlers in `src/main/index.ts`:
   - `startNewSession`: calls `chatService.startNewSession(workspacePath)`
   - `openSession`: calls `chatService.openSession(sessionId)`
   - `sendMessage`: calls `chatService.sendMessage(sessionId, text, (chunk) => event.sender.send(chatOutput, chunk))`
6. Add input validation in IPC handlers (`sessionId` and `workspacePath` must be non-empty strings; `text` must be non-empty)

**Exit criteria**:

- `startNewSession` returns a new `Session` with a valid id
- `openSession` returns a `ChatMessage[]` (may be empty for a brand-new session)
- `sendMessage` triggers streaming `chatOutput` events to the renderer
- Integration tests pass with mocked CLI execution

**Dependencies**: Phase 1 (shared types); Phase 3 (session model); live validation from step 1 should precede steps 2–5.

---

### Phase 5: Renderer — Sidebar and Workspace Navigation

**Objective**: Replace the static `SidebarFrame` with a live, data-driven sidebar that shows workspaces and sessions.

**Steps**:

1. Create `WorkspaceItem` component (`src/renderer/src/components/WorkspaceItem.tsx`):
   - Accepts `workspace: Workspace`, `isActive: boolean`, `onClick` handler
   - Folder icon + workspace name
   - Visually distinct active state using existing token system
2. Create `SessionItem` component (`src/renderer/src/components/SessionItem.tsx`):
   - Accepts `session: Session`, `isActive: boolean`, `onClick` handler
   - Indented under workspace, lighter visual weight
   - Title + optional timestamp
3. Refactor `SidebarFrame`:
   - Accept `workspaces: Workspace[]`, `activeWorkspaceId: string | null`, `sessions: Session[]`, `activeSessionId: string | null`, `onSelectWorkspace`, `onAddWorkspace`, `onSelectSession`, `onNewChat` props
   - Render workspace list with `WorkspaceItem` for each entry
   - Render session list with `SessionItem` for each session under the active workspace
   - Show a workspace-level empty state when sessions is an empty array
   - Show a "+" button in the workspace header area
   - "New chat" action visible within the active workspace context
4. Update `AuthenticatedShell` to:
   - load workspaces on mount via `window.agentflow.listWorkspaces()`
   - load sessions when a workspace is selected via `window.agentflow.listSessions(path)`
   - pass all needed props to `SidebarFrame`
   - manage `WorkspaceViewState` (see renderer state architecture section)

**Exit criteria**:

- Left rail shows real workspaces and sessions (or their empty states) rather than static placeholder text
- Selecting a workspace triggers a session list load
- The "+" button is visible when at least one workspace exists
- E2E test in `workspace.e2e.ts` asserts the workspace appears in the sidebar after `addWorkspace`

**Dependencies**: Phase 2 (workspace IPC), Phase 3 (session IPC), Phase 1 (types)

---

### Phase 6: Renderer — Main Panel States

**Objective**: Wire the main panel to reflect workspace selection and session activation.

**Steps**:

1. Ensure `ShellEmptyState` triggers `addWorkspace` when "Start a new project" is clicked (rather than doing nothing as in M1). Wire the existing CTA to `window.agentflow.addWorkspace()`.
2. Create `WorkspaceEmptyState` component (`src/renderer/src/components/WorkspaceEmptyState.tsx`):
   - Shown when a workspace is selected but no sessions exist
   - Short headline and orientation copy
   - Prominent "New chat" action
3. Create `SessionLoadError` component (`src/renderer/src/components/SessionLoadError.tsx`):
   - Shown when `listSessions` fails
   - Actionable inline error with retry button
4. Update `AuthenticatedShell` to route the main panel content based on `WorkspaceViewState`:
   - `no_workspace` → existing `ShellEmptyState`
   - `workspace_selected` with empty sessions → `WorkspaceEmptyState`
   - `workspace_selected` with sessions but none active → `WorkspaceEmptyState` (or a sessions-present variant)
   - `active_session` → `ChatView` (Phase 7)

**Exit criteria**:

- "Start a new project" CTA opens the folder dialog
- After adding a workspace, the main panel transitions to the workspace-selected state
- Selecting a workspace with no sessions shows the `WorkspaceEmptyState` with a "New chat" action
- E2E tests in `workspace.e2e.ts` cover CTA interaction and post-add state

**Dependencies**: Phase 5 (sidebar), Phase 2 (workspace IPC)

---

### Phase 7: Renderer — Chat Surface

**Objective**: Build the active chat surface and wire session creation and messaging.

**Steps**:

1. Create `ChatMessage` display component (`src/renderer/src/components/ChatMessage.tsx`):
   - Accepts `message: ChatMessage`
   - User and assistant turns visually distinct (alignment, background, or typography — not heavy cards)
   - Uses token system for color and spacing
2. Create `ChatTranscript` component (`src/renderer/src/components/ChatTranscript.tsx`):
   - Accepts `messages: ChatMessage[]`, `isStreaming: boolean`, `streamingChunk: string`
   - Renders all prior messages, then a partial streaming message if `isStreaming` is true
   - Auto-scrolls to the bottom on new content
3. Create `ChatComposer` component (`src/renderer/src/components/ChatComposer.tsx`):
   - Text input (multi-line textarea or equivalent) + send button
   - Static "Strategist" label as a non-interactive agent indicator
   - Disabled state when `isStreaming` is true
   - Keyboard shortcut: Enter to send (Shift+Enter for new line)
   - Clears input after send
4. Create `ChatView` component (`src/renderer/src/components/ChatView.tsx`):
   - Composes `ChatTranscript` + `ChatComposer`
   - Accepts `session: Session`, `initialMessages: ChatMessage[]`, `onSend: (text: string) => void`, `isStreaming: boolean`, `streamingChunk: string`
   - Transcript occupies the majority of the panel; composer anchors to the bottom
5. Wire session creation and messaging in `AuthenticatedShell`:
   - "New chat" calls `window.agentflow.startNewSession(workspace.path)`, transitions to `active_session` state with empty messages
   - Session select calls `window.agentflow.openSession(session.id)`, transitions to `active_session` with returned messages
   - Send calls `window.agentflow.sendMessage(session.id, text)`; subscribes to `window.agentflow.onChatOutput` for streaming chunks
   - On stream complete, appends the assembled assistant message to the transcript and clears the streaming state
6. Register `onChatOutput` listener in the preload bridge (analogous to `onLoginOutput`)

**Exit criteria**:

- New chat opens an empty transcript with the Strategist label and a ready composer
- User message appears in transcript after send
- Streaming response appears progressively
- Composer is disabled during streaming and re-enabled after response completes
- Prior session opens with existing transcript visible and composer ready
- E2E tests in `session.e2e.ts` verify new chat entry and message send flow (against mocked CLI)

**Dependencies**: Phase 4 (chat IPC), Phase 5 (sidebar wiring), Phase 6 (main panel routing)

---

### Phase 8: Hardening and Milestone Closeout

**Objective**: Stabilize M2 behavior, close coverage gaps, and hand off to M3.

**Steps**:

1. Add unit tests:
   - `WorkspaceService` load, save, add, deduplication
   - Session file parsing and title derivation with fixture data
   - `WorkspaceViewState` reducer or hook transitions
2. Add integration tests:
   - `addWorkspace` IPC handler (dialog mock + service calls)
   - `listSessions` IPC handler (mocked adapter)
   - `sendMessage` IPC handler (mocked adapter + streaming push)
3. Add E2E tests:
   - `workspace.e2e.ts`: add workspace → appears in sidebar; workspace persists across restart; "+" button opens dialog
   - `session.e2e.ts`: new chat → chat surface appears; send message → response appears; workspace with mocked sessions → sessions listed
4. Manual validation:
   - Full flow: add workspace → see sessions → open prior session → continue chat
   - Empty workspace (no sessions): correct empty state shown
   - Multiple workspaces: switch between them, session list updates
   - Error cases: CLI unavailable during session discovery, send failure
   - Light and dark theme in all new states
5. Capture gaps for M3: agent selector, file context, session deletion, workspace removal

**Dependencies**: All prior phases

---

## Impacted Files

### New files

- `src/shared/workspace-types.ts`
- `src/main/workspace-service.ts`
- `src/main/session-service.ts`
- `src/main/chat-service.ts`
- `src/infrastructure/system/interactive-command-runner.ts` (required for Option B — selected for M2)
- `src/renderer/src/components/WorkspaceItem.tsx`
- `src/renderer/src/components/SessionItem.tsx`
- `src/renderer/src/components/WorkspaceEmptyState.tsx`
- `src/renderer/src/components/SessionLoadError.tsx`
- `src/renderer/src/components/ChatView.tsx`
- `src/renderer/src/components/ChatTranscript.tsx`
- `src/renderer/src/components/ChatComposer.tsx`
- `src/renderer/src/components/ChatMessage.tsx`
- `tests/unit/workspace-service.test.ts`
- `tests/unit/session-parsing.test.ts`
- `tests/integration/workspace-ipc.test.ts`
- `tests/integration/session-ipc.test.ts`
- `tests/integration/chat-ipc.test.ts`
- `tests/e2e/workspace.e2e.ts`
- `tests/e2e/session.e2e.ts`

### Modified files

- `src/shared/ipc.ts` — new channels and `AgentflowApi` extension
- `src/preload/index.ts` — expose new methods via contextBridge
- `src/main/index.ts` — register new IPC handlers
- `src/infrastructure/copilot/adapter.ts` — `listSessions`, `startNewSession`, `openSession`, `sendMessage`
- `src/renderer/src/components/SidebarFrame.tsx` — live workspace + session lists
- `src/renderer/src/components/AuthenticatedShell.tsx` — workspace/session state management
- `src/renderer/src/components/ShellEmptyState.tsx` — wire CTA to `addWorkspace`

---

## Key Implementation Dependencies

These must be resolved before the affected phases can proceed:

| Dependency | Affects | Status |
|---|---|---|
| Copilot CLI sessions directory path and file format | Phase 3 | **Confirmed** — `~/.copilot/session-state/<session-id>/events.jsonl`; see Session Discovery Strategy |
| Copilot CLI chat invocation contract | Phase 4 | **Confirmed** — Option B selected; `copilot --agent=strategist` (cwd = workspace), `copilot --resume=<session-id>` to continue; see Chat Process Strategy |
| Session continuation command | Phase 4 | **Confirmed** — `copilot --resume=<session-id>`; `copilot --continue` for most-recent session |

---

## Risks

### Risk 1: Copilot CLI Session Format Is Undocumented or Unstable

**Why it matters**: If the session directory structure changes between CLI versions, session discovery breaks silently.

**Mitigation**:
- Isolate all session file parsing behind a clearly bounded `parseSessionFile()` function that returns null on unexpected shape rather than throwing
- The adapter's `listSessions` returns empty array on any unrecognised structure — the UI falls back to the empty-sessions state

### Risk 2: Interactive CLI Process Has Unexpected Output Format

**Why it matters**: The `InteractiveCommandRunner` must correctly identify stream-start, token-streaming, and stream-end signals from the `copilot` process. If the output format differs from expectations, streaming will not work correctly.

**Mitigation**:
- T11 validates the live output format before the adapter is built
- The adapter's `sendMessage` emits `onData` chunks conservatively — any output line that cannot be parsed as a known control signal is treated as content
- Integration tests use fixture output recordings so the parser can be validated independently of the live CLI

### Risk 3: Workspace Persistence File Conflicts With Other App Instances

**Why it matters**: If two windows of the app write simultaneously, the JSON index could be corrupted.

**Mitigation**:
- Electron is a single-window app in phase 1; concurrent writes are not expected
- Reads are performed at startup only; writes are atomic via full-file replace
- If concurrent access becomes a concern in a future milestone, switch to a structured store (e.g., `electron-store`)

### Risk 4: `AuthenticatedShell` Grows Too Large With Workspace State

**Why it matters**: Monolithic state in a single component becomes hard to test and reason about.

**Mitigation**:
- Extract workspace/session state into a dedicated `useWorkspaceState` hook from the start
- Keep `AuthenticatedShell` as a thin composition layer that reads from the hook and passes props down
- The hook is independently unit-testable

### Risk 5: Chat Streaming State Is Lost on Workspace Switch

**Why it matters**: If the user switches workspace mid-stream, the streaming state and active session must be cleaned up gracefully.

**Mitigation**:
- Workspace switch cancels any in-progress stream (via IPC teardown or by ignoring late `chatOutput` events using a generation counter)
- The UI transitions immediately to the new workspace state without waiting for the stream to finish

---

## Test Approach

### Unit Tests

Focus areas:

- `WorkspaceService`: load (file exists), load (file missing), add (new path), add (duplicate path deduplication), save
- Session file parsing: valid JSON with all fields, missing title field (timestamp fallback), missing workspace path field (filtered out)
- `WorkspaceViewState` reducer or hook: all state transitions from the renderer state model above

### Integration Tests

Focus areas:

- `addWorkspace` IPC handler: dialog mock returning a path, dialog mock returning cancelled, service write and return value
- `listSessions` IPC handler: adapter mock returning sessions, adapter mock returning empty, adapter mock throwing (returns error state)
- `sendMessage` IPC handler: sends chunk events to renderer, handles adapter throw
- `startNewSession` IPC handler: returns a new `Session`, handles adapter throw
- `openSession` IPC handler: returns `ChatMessage[]`, handles adapter throw

### End-to-End Tests

Scope:

- `workspace.e2e.ts`:
  - App launches authenticated → "Start a new project" CTA is visible
  - Clicking CTA opens folder dialog (dialog can be intercepted with Playwright dialog stub or mocked via IPC mock)
  - After workspace added, workspace name appears in the sidebar
  - Workspace persists across app restart
  - "+" button visible after first workspace added
- `session.e2e.ts`:
  - Selecting a workspace with mocked sessions → session list appears in sidebar
  - Selecting workspace with no sessions → empty state shown
  - Clicking "New chat" → chat surface appears
  - Sending a message → user turn appears in transcript (streamed response can be mocked)

E2E tests must mock CLI behavior via IPC interception or environment fixtures. No test should require a live Copilot CLI session.
