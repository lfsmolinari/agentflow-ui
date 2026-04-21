# Tasks: Milestone 2

## Status

- **Created**: 2026-04-14
- **Author**: Architect
- **Milestone**: Milestone 2 — Workspace creation, new Strategist chat, previous session retrieval

## Prerequisites

Milestone 1 is complete and all tests pass. No M2 task may begin before:

- `npm run typecheck` passes on the M1 codebase
- `npm test` passes (41+ unit/integration tests)
- `npm run test:e2e` passes the startup flow E2E tests

## Dependency Graph

```
T01 (shared types)
  └── T02 (IPC channels + AgentflowApi)
        └── T03 (preload bridge)
              ├── T04 (WorkspaceService)         [P]
              │     └── T05 (workspace IPC handlers)
              │           └── T09 (renderer sidebar + workspace state)
              │                 └── T10 (main panel routing)
              │                       └── T13 (chat view wiring)
              ├── T06 (CLI sessions research)    [P]
              │     └── T07 (listSessions adapter)
              │           └── T08 (session IPC handler)
              │                 └── T09
              └── T11 (CLI chat validation)        [P]
                    └── T12a (interactive runner — required)
                          └── T12 (chat adapter methods)
                                └── T13 (chat IPC handlers)

T14 (WorkspaceItem component)                   [P with T09]
T15 (SessionItem component)                     [P with T09]
T16 (WorkspaceEmptyState component)             [P with T10]
T17 (ChatTranscript + ChatMessage components)   [P with T13]
T18 (ChatComposer component)                    [P with T13]
T19 (ChatView component)                        depends on T17, T18
T20 (unit tests)                                depends on T04, T07
T21 (integration tests)                         depends on T05, T08, T13
T22 (E2E workspace.e2e.ts)                      depends on T09, T10
T23 (E2E session.e2e.ts)                        depends on T13
```

`[P]` = parallelisable with the tasks listed beside it once their shared dependency is met.

---

## Phase 1: Shared Types and IPC Contracts

### Task T01: Add Shared Workspace and Session Types

**Plan reference**: Phase 1, step 1  
**Dependencies**: None  
**Parallel**: No — all other tasks depend on these types  
**Files likely affected**:
- `src/shared/workspace-types.ts` (new)

**Description**: Create `src/shared/workspace-types.ts` exporting `Workspace`, `Session`, and `ChatMessage` types as defined in the plan. These are the typed data shapes used at every IPC boundary.

```ts
export interface Workspace { path: string; name: string; }
export interface Session { id: string; title: string; workspacePath: string; createdAt?: string; }
export interface ChatMessage { role: 'user' | 'assistant'; content: string; }
```

**Acceptance**:
- File compiles with `npm run typecheck`
- All three interfaces are exported and importable from a shared alias path
- No unit test required for this task alone — verified by compilation

---

### Task T02: Extend IPC Channels and AgentflowApi Interface

**Plan reference**: Phase 1, step 2  
**Dependencies**: T01  
**Parallel**: No  
**Files likely affected**:
- `src/shared/ipc.ts`

**Description**: Add new channel name constants to `IPC_CHANNELS` and extend the `AgentflowApi` interface with the new method signatures for workspace, session, and chat operations.

New channels: `listWorkspaces`, `addWorkspace`, `listSessions`, `startNewSession`, `openSession`, `sendMessage`, `chatOutput`.

New `AgentflowApi` methods:
```ts
listWorkspaces: () => Promise<Workspace[]>
addWorkspace: () => Promise<Workspace[]>
listSessions: (workspacePath: string) => Promise<Session[]>
startNewSession: (workspacePath: string) => Promise<Session>
openSession: (sessionId: string) => Promise<ChatMessage[]>
sendMessage: (sessionId: string, text: string) => Promise<void>
onChatOutput: (callback: (chunk: string) => void) => () => void
```

**Acceptance**:
- `npm run typecheck` passes
- All new channel constants are in `IPC_CHANNELS`
- `AgentflowApi` interface includes all new method signatures with correct parameter and return types

---

### Task T03: Extend Preload Bridge

**Plan reference**: Phase 1, step 3  
**Dependencies**: T02  
**Parallel**: No  
**Files likely affected**:
- `src/preload/index.ts`

**Description**: Extend the `api` object in `src/preload/index.ts` to implement all new `AgentflowApi` methods via `ipcRenderer.invoke` and `ipcRenderer.on`. The `onChatOutput` method follows the same pattern as the existing `onLoginOutput` — register a listener and return an unlisten function.

**Acceptance**:
- `npm run typecheck` passes
- `contextBridge.exposeInMainWorld('agentflow', api)` exposes all new methods
- `onChatOutput` returns a cleanup function that removes the IPC listener
- Stub IPC handlers in main do not yet exist, but the preload compiles and exposes the interface shape

---

## Phase 2: Workspace Service and IPC Handlers

### Task T04: Implement WorkspaceService

**Plan reference**: Phase 2, steps 1  
**Dependencies**: T01  
**Parallel**: Yes — can run alongside T06 and T11 once T01 is done  
**Files likely affected**:
- `src/main/workspace-service.ts` (new)

**Description**: Create `WorkspaceService` with `load()`, `save()`, and `add()` methods. Use `app.getPath('userData')` to locate `agentflow-workspaces.json`. Derive workspace `name` as `path.basename(folderPath)`. Deduplicate by path in `add()`. Use atomic full-file replace for writes.

**Acceptance**:
- `load()` returns `[]` when the file is absent
- `load()` returns the parsed array when the file exists
- `add()` with a new path appends and returns the updated list
- `add()` with a duplicate path returns the list unchanged (deduplication)
- `save()` writes a valid JSON file
- Unit tests in `tests/unit/workspace-service.test.ts` pass all of the above cases
- `npm test` passes

---

### Task T05: Register Workspace IPC Handlers

**Plan reference**: Phase 2, steps 2–4  
**Dependencies**: T03, T04  
**Parallel**: No  
**Files likely affected**:
- `src/main/index.ts`

**Description**: Register `listWorkspaces` and `addWorkspace` IPC handlers. The `addWorkspace` handler calls `dialog.showOpenDialog` with `properties: ['openDirectory']`. On selection, calls `workspaceService.add(path)` and returns the updated list. On cancellation, returns the unmodified existing list. Validates that the IPC payload for `addWorkspace` does not require a user-supplied path (the path comes from the dialog, not from the renderer).

**Acceptance**:
- `listWorkspaces` returns the workspace list from `WorkspaceService.load()`
- `addWorkspace` opens the native folder dialog
- Folder selection adds the workspace and returns the updated list
- Dialog cancellation returns the unchanged list without error
- Integration test in `tests/integration/workspace-ipc.test.ts` mocks the dialog and verifies both paths
- `npm test` passes

---

## Phase 3: Session Discovery

### Task T06: Validate Copilot CLI Session Storage

**Plan reference**: Phase 3, step 1  
**Dependencies**: T01  
**Parallel**: Yes — can run alongside T04 and T11  
**Files likely affected**:
- `src/infrastructure/copilot/adapter.ts` (comment block only)

**Description**: The Copilot CLI session storage path and format are already confirmed per official documentation: sessions are stored under `~/.copilot/session-state/<session-id>/events.jsonl` (JSONL format), with key fields `sessionId`, `timestamp`, `cwd`, and `source`. T06 is now a **validation task**: confirm on the live CLI that `~/.copilot/session-state/` exists and contains the expected subdirectory/events.jsonl structure. Document the confirmed findings in a short comment block at the top of the adapter extension in `src/infrastructure/copilot/adapter.ts`. T07 may proceed in parallel once T06 starts — it does not need to wait for T06 to complete since the path and format are already known from documentation.

**Acceptance**:
- The sessions directory path and JSONL format are documented in a comment in `src/infrastructure/copilot/adapter.ts` before any adapter code is written
- If `~/.copilot/session-state/` does not exist at runtime on the development machine, the finding is noted in the comment and T07 proceeds using the documented path (T07's empty-directory case already returns `[]`)
- T07 can proceed in parallel once T06 starts

---

### Task T07: Extend CopilotCliAdapter — listSessions

**Plan reference**: Phase 3, steps 2  
**Dependencies**: T06  
**Parallel**: No  
**Files likely affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**: Add `listSessions(workspacePath: string): Promise<Session[]>` to `CopilotCliAdapter`. Reads the confirmed CLI sessions directory, filters entries by workspace path match, derives session titles (metadata title → first user message → timestamp fallback), and returns sorted by recency. Returns empty array if the directory is absent or unreadable. Does not throw.

**Acceptance**:
- Returns typed `Session[]` for a workspace with CLI sessions (validated against fixture JSON files)
- Returns `[]` for a workspace with no matching sessions
- Returns `[]` if the sessions directory does not exist (no crash)
- Unit tests in `tests/unit/session-parsing.test.ts` cover all three cases using fixture files
- `npm test` passes

---

### Task T08: Register listSessions IPC Handler

**Plan reference**: Phase 3, steps 3–4  
**Dependencies**: T03, T07  
**Parallel**: No  
**Files likely affected**:
- `src/main/session-service.ts` (new)
- `src/main/index.ts`

**Description**: Create a `SessionService` with a `listSessions(workspacePath)` method that delegates to `CopilotCliAdapter` and catches errors, returning an empty array on failure. Register the `listSessions` IPC handler. Validate that `workspacePath` is a non-empty string in the handler before calling the service.

**Acceptance**:
- `listSessions` IPC handler returns a `Session[]` for a valid path
- Returns `[]` on adapter error without propagating the exception to the renderer
- Integration test in `tests/integration/session-ipc.test.ts` mocks the adapter and verifies success and error paths
- `npm test` passes

---

## Phase 4: Chat Infrastructure

### Task T11: Validate Copilot CLI Chat Invocation

**Plan reference**: Phase 4, step 1  
**Dependencies**: T01  
**Parallel**: Yes — can run alongside T04 and T06  
**Files likely affected**: None — validation task; findings documented in adapter comments

**Description**: Option B (interactive stdin/stdout) is already selected for M2 based on official documentation. T11 is a **validation task**: confirm the interactive behaviour with the live CLI.

- Spawn `copilot --agent=strategist` in a test directory and confirm that stdin/stdout piping works as expected
- Confirm `copilot --resume=<session-id>` successfully continues a prior session
- Observe the output format to understand how response start, token streaming, and response end are signalled
- Document the confirmed command signatures and output format in a comment block in `src/infrastructure/copilot/adapter.ts`

T12a (`InteractiveCommandRunner`) is a **required** task — not conditional. T12 depends on T12a.

**Acceptance**:
- Interactive `copilot --agent=strategist` process with stdin/stdout piping is confirmed to work
- `copilot --resume=<session-id>` session continuation is confirmed
- Output format (stream start/end signals) is documented in adapter comments
- T12a proceeds as a required step — no conditional language remains

---

### Task T12a: Interactive Command Runner

**Plan reference**: Phase 4, step 3  
**Dependencies**: T11  
**Parallel**: No  
**Files likely affected**:
- `src/infrastructure/system/interactive-command-runner.ts` (new)

**Description**: Implement `InteractiveCommandRunner` for the confirmed interactive `copilot` process pattern. Spawns a child process with `stdio: ['pipe', 'pipe', 'pipe']`, exposes a `write(text: string): void` method for sending stdin, emits stdout chunks via the `onData` callback, and exposes a `close()` method to terminate the process. Must handle process exit and error events gracefully. This is a required task — T12 depends on it.

**Acceptance**:
- `write()` sends data to the child process stdin
- stdout chunks are delivered to the `onData` callback
- `close()` terminates the process cleanly
- Unit test verifies send/receive loop with a simple echo command
- `npm test` passes

---

### Task T12: Extend CopilotCliAdapter — Chat Methods

**Plan reference**: Phase 4, step 2  
**Dependencies**: T07, T12a  
**Parallel**: No  
**Files likely affected**:
- `src/infrastructure/copilot/adapter.ts`

**Description**: Add three methods to `CopilotCliAdapter`:

- `startNewSession(workspacePath: string): Promise<Session>` — invokes the CLI to create a new session; returns typed `Session` with id and initial title
- `openSession(sessionId: string): Promise<ChatMessage[]>` — loads the prior session transcript; returns `ChatMessage[]`
- `sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void>` — sends a message and streams the response

Uses Option B (interactive `InteractiveCommandRunner`) as confirmed by T11 and implemented by T12a.

**Acceptance**:
- `startNewSession` returns a valid `Session` object when the CLI succeeds; throws on failure
- `openSession` returns prior turns as `ChatMessage[]`; returns `[]` for new sessions; throws on unrecoverable error
- `sendMessage` calls `onData` one or more times with streaming chunks; resolves on completion; throws on failure
- Integration tests with mocked CLI output pass
- `npm test` passes

---

### Task T13: Register Chat IPC Handlers

**Plan reference**: Phase 4, steps 4–6  
**Dependencies**: T03, T12  
**Parallel**: No  
**Files likely affected**:
- `src/main/chat-service.ts` (new)
- `src/main/index.ts`

**Description**: Create `ChatService` delegating to `CopilotCliAdapter` for `startNewSession`, `openSession`, and `sendMessage`. Register IPC handlers. The `sendMessage` handler streams `chatOutput` push events to the renderer using `event.sender.send`. Validate `sessionId` (non-empty string) and `text` (non-empty string) before passing to the service.

**Acceptance**:
- `startNewSession` IPC returns a `Session` object
- `openSession` IPC returns `ChatMessage[]`
- `sendMessage` IPC triggers `chatOutput` push events on the sender window
- All handlers reject invalid input with a typed error response rather than crashing
- Integration tests in `tests/integration/chat-ipc.test.ts` pass with mocked adapter
- `npm test` passes

---

## Phase 5: Renderer — Sidebar and Workspace Navigation

### Task T14: WorkspaceItem Component

**Plan reference**: Phase 5, step 1  
**Dependencies**: T01  
**Parallel**: Yes — can be built in parallel with T15 and T16 once T01 is done  
**Files likely affected**:
- `src/renderer/src/components/WorkspaceItem.tsx` (new)

**Description**: Create a `WorkspaceItem` component that accepts `workspace: Workspace`, `isActive: boolean`, and `onClick`. Renders a folder icon and the workspace name. Applies a visually distinct active style using the existing token system (not ad hoc colors). Inactive items have a lower-prominence style.

**Acceptance**:
- Renders workspace name correctly
- Active and inactive states are visually distinct using token variables
- Component is accessible (keyboard-focusable, role="button" or similar)
- No snapshot test; unit test verifies active/inactive class application
- `npm test` passes

---

### Task T15: SessionItem Component

**Plan reference**: Phase 5, step 2  
**Dependencies**: T01  
**Parallel**: Yes  
**Files likely affected**:
- `src/renderer/src/components/SessionItem.tsx` (new)

**Description**: Create a `SessionItem` component accepting `session: Session`, `isActive: boolean`, and `onClick`. Renders the session title and optionally the `createdAt` timestamp in a quieter style. Visually nested beneath the workspace level (indented). Lighter visual weight than `WorkspaceItem`.

**Acceptance**:
- Renders session title; falls back to formatted timestamp if title is empty
- Active session is visually distinct
- `createdAt` is displayed in a human-readable relative or short absolute format
- `npm test` passes

---

### Task T09: Refactor SidebarFrame and Wire Workspace State

**Plan reference**: Phase 5, steps 3–4  
**Dependencies**: T05, T08, T14, T15  
**Parallel**: No  
**Files likely affected**:
- `src/renderer/src/components/SidebarFrame.tsx`
- `src/renderer/src/components/AuthenticatedShell.tsx`

**Description**: Refactor `SidebarFrame` to accept live workspace and session props (see plan Phase 5, step 3). Update `AuthenticatedShell` to:
1. Load workspaces on mount with `window.agentflow.listWorkspaces()`
2. Auto-select the first workspace if the list is non-empty
3. Load sessions for the selected workspace with `window.agentflow.listSessions(path)`
4. Manage `WorkspaceViewState` as described in the plan
5. Pass props to `SidebarFrame` and handle events: `onSelectWorkspace`, `onAddWorkspace`, `onSelectSession`, `onNewChat`

Extract the workspace/session state into a `useWorkspaceState` hook for independent testability.

**Acceptance**:
- After app loads, workspace list is populated from the workspace service
- Clicking a workspace updates the session list
- "+" button calls `window.agentflow.addWorkspace()` and refreshes the list
- Sidebar renders `WorkspaceItem` and `SessionItem` components from real data
- E2E test in `workspace.e2e.ts` asserts workspace name appears after `addWorkspace`
- `npm run test:e2e` passes

---

## Phase 6: Renderer — Main Panel States

### Task T16: WorkspaceEmptyState Component

**Plan reference**: Phase 6, step 2  
**Dependencies**: T01  
**Parallel**: Yes  
**Files likely affected**:
- `src/renderer/src/components/WorkspaceEmptyState.tsx` (new)

**Description**: Create `WorkspaceEmptyState` shown when a workspace is selected but has no sessions. Short headline (e.g., "No chats yet"), one line of orientation copy, and a prominent "New chat" primary action button. Must not reuse the M1 "Start a new project" headline — this state is contextually different.

**Acceptance**:
- Shows a headline and primary action button
- "New chat" button calls the provided `onNewChat` prop
- Does not show a workspace folder picker (that is the job of `ShellEmptyState`)
- `npm test` passes

---

### Task T10: Wire Main Panel to WorkspaceViewState and Connect CTA

**Plan reference**: Phase 6, steps 1, 4  
**Dependencies**: T09, T16  
**Parallel**: No  
**Files likely affected**:
- `src/renderer/src/components/AuthenticatedShell.tsx`
- `src/renderer/src/components/ShellEmptyState.tsx`

**Description**: Update `AuthenticatedShell` to route the main panel content based on `WorkspaceViewState`:
- `no_workspace` → `ShellEmptyState` (existing, but now wired to call `addWorkspace`)
- `workspace_selected` with empty sessions → `WorkspaceEmptyState`
- `active_session` → `ChatView` (deferred to T19)

Wire the "Start a new project" CTA in `ShellEmptyState` to call `window.agentflow.addWorkspace()`. Currently the button does nothing (M1 left it as a placeholder).

Also create `SessionLoadError` for the failure path of `listSessions`.

**Acceptance**:
- "Start a new project" opens the folder dialog
- After adding a workspace, main panel transitions from `ShellEmptyState` to `WorkspaceEmptyState`
- A workspace with no sessions shows `WorkspaceEmptyState`
- `listSessions` failure renders `SessionLoadError` with a retry button
- E2E test in `workspace.e2e.ts` covers: CTA interaction → workspace added → correct state shown
- `npm run test:e2e` passes

---

## Phase 7: Renderer — Chat Surface

### Task T17: ChatTranscript and ChatMessage Components

**Plan reference**: Phase 7, steps 1–2  
**Dependencies**: T01  
**Parallel**: Yes — can be built in parallel with T18  
**Files likely affected**:
- `src/renderer/src/components/ChatTranscript.tsx` (new)
- `src/renderer/src/components/ChatMessage.tsx` (new)

**Description**: Create `ChatMessage` component with distinct user and assistant styling (not boxed cards — use alignment, typography weight, or subtle background difference). Create `ChatTranscript` that renders a list of `ChatMessage` components plus an in-progress streaming chunk when `isStreaming` is true. Auto-scrolls to the bottom on new content.

**Acceptance**:
- User and assistant messages are visually distinguishable
- Streaming chunk appears as a partial assistant message at the bottom of the list
- Auto-scroll works when new messages are appended
- Styling uses token variables, not hard-coded colors
- `npm test` passes

---

### Task T18: ChatComposer Component

**Plan reference**: Phase 7, step 3  
**Dependencies**: None (pure UI component)  
**Parallel**: Yes — can be built in parallel with T17  
**Files likely affected**:
- `src/renderer/src/components/ChatComposer.tsx` (new)

**Description**: Create `ChatComposer` with: a multi-line text input, a static "Strategist" agent label, and a send button. Enter sends (Shift+Enter inserts newline). Disabled state when `isStreaming` prop is true. Clears input after send. Calls `onSend(text)` prop. No agent selector or file attachment in this milestone.

**Acceptance**:
- Send button is disabled when `isStreaming` is true
- Enter key sends the message; Shift+Enter inserts a newline
- Input clears after send
- "Strategist" label is visible but not interactive
- Composer is keyboard accessible
- `npm test` passes

---

### Task T19: ChatView Component and Session Wiring

**Plan reference**: Phase 7, steps 4–6  
**Dependencies**: T13, T17, T18, T09  
**Parallel**: No  
**Files likely affected**:
- `src/renderer/src/components/ChatView.tsx` (new)
- `src/renderer/src/components/AuthenticatedShell.tsx`

**Description**: Create `ChatView` composing `ChatTranscript` and `ChatComposer`. Transcript fills the upper region; composer anchors the bottom. Update `AuthenticatedShell` to:
- On "New chat": call `window.agentflow.startNewSession(workspace.path)`, transition to `active_session` with empty messages
- On session select: call `window.agentflow.openSession(session.id)`, transition to `active_session` with returned messages
- On composer send: call `window.agentflow.sendMessage(session.id, text)`, subscribe to `window.agentflow.onChatOutput` for chunks
- Assemble streaming chunks into a full assistant message on completion; clear streaming state
- Use a generation counter or ref to discard late-arriving `chatOutput` events after workspace switch

**Acceptance**:
- New chat opens an empty transcript with composer ready
- Send produces a user message in transcript immediately
- Streaming response appears progressively via `chatOutput` events
- Composer disables during streaming; re-enables after response completes
- Prior session restores with full transcript visible
- Workspace switch while streaming cleans up correctly — no stale chunks appear in the new workspace view
- E2E test in `session.e2e.ts` covers: new chat entry, message send, streamed response (mocked), prior session restoration
- `npm run test:e2e` passes

---

## Phase 8: Tests and Hardening

### Task T20: Unit Tests

**Plan reference**: Phase 8, step 1  
**Dependencies**: T04, T07  
**Parallel**: Yes  
**Files likely affected**:
- `tests/unit/workspace-service.test.ts` (new)
- `tests/unit/session-parsing.test.ts` (new)

**Description**: Write unit tests for `WorkspaceService` (load/save/add/deduplication) and session file parsing (title derivation, filtering by workspace path, missing-directory handling). Use fixture JSON files for session parsing. All tests must use mocked filesystem — no real file I/O.

**Acceptance**:
- All cases documented in the plan pass
- `npm test` passes with no regressions

---

### Task T21: Integration Tests

**Plan reference**: Phase 8, step 2  
**Dependencies**: T05, T08, T13  
**Parallel**: Yes  
**Files likely affected**:
- `tests/integration/workspace-ipc.test.ts` (new)
- `tests/integration/session-ipc.test.ts` (new)
- `tests/integration/chat-ipc.test.ts` (new)

**Description**: Write integration tests for all new IPC handlers using mocked adapters and services. Cover success paths, error paths, and input validation for each handler.

**Acceptance**:
- All handlers are covered for success, error, and invalid-input scenarios
- `npm test` passes with no regressions

---

### Task T22: E2E Tests — workspace.e2e.ts

**Plan reference**: Phase 8, step 3  
**Dependencies**: T09, T10  
**Parallel**: Yes  
**Files likely affected**:
- `tests/e2e/workspace.e2e.ts` (new)

**Description**: Write E2E tests covering: "Start a new project" CTA is visible on authenticated empty shell; clicking it opens a folder dialog (mock via Playwright or IPC interception); after workspace is added, the workspace name appears in the sidebar; workspace persists across app restart; "+" button is visible after first workspace.

**Acceptance**:
- All test cases pass with `npm run test:e2e`
- Tests do not require a live Copilot CLI — CLI interactions are mocked

---

### Task T23: E2E Tests — session.e2e.ts

**Plan reference**: Phase 8, step 3  
**Dependencies**: T19  
**Parallel**: Yes  
**Files likely affected**:
- `tests/e2e/session.e2e.ts` (new)

**Description**: Write E2E tests covering: selecting a workspace with mocked sessions shows the session list; selecting a workspace with no sessions shows the empty state; clicking "New chat" transitions the main panel to the chat surface; sending a message shows the user turn in the transcript; streamed response appears (mocked).

**Acceptance**:
- All test cases pass with `npm run test:e2e`
- Tests do not require a live Copilot CLI

---

## Task Summary

| ID | Title | Phase | Parallel | Depends On |
|---|---|---|---|---|
| T01 | Shared workspace and session types | 1 | No | — |
| T02 | IPC channel extensions | 1 | No | T01 |
| T03 | Preload bridge extension | 1 | No | T02 |
| T04 | WorkspaceService | 2 | Yes | T01 |
| T05 | Workspace IPC handlers | 2 | No | T03, T04 |
| T06 | Research CLI session storage | 3 | Yes | T01 |
| T07 | listSessions adapter method | 3 | No | T06 |
| T08 | listSessions IPC handler | 3 | No | T03, T07 |
| T09 | SidebarFrame refactor + workspace state | 5 | No | T05, T08, T14, T15 |
| T10 | Main panel routing + CTA wiring | 6 | No | T09, T16 |
| T11 | Research CLI chat invocation | 4 | Yes | T01 |
| T12a | Interactive command runner (conditional) | 4 | No | T11 |
| T12 | Chat adapter methods | 4 | No | T07, T11 [T12a] |
| T13 | Chat IPC handlers | 4 | No | T03, T12 |
| T14 | WorkspaceItem component | 5 | Yes | T01 |
| T15 | SessionItem component | 5 | Yes | T01 |
| T16 | WorkspaceEmptyState component | 6 | Yes | T01 |
| T17 | ChatTranscript + ChatMessage components | 7 | Yes | T01 |
| T18 | ChatComposer component | 7 | Yes | — |
| T19 | ChatView + session wiring | 7 | No | T13, T17, T18, T09 |
| T20 | Unit tests | 8 | Yes | T04, T07 |
| T21 | Integration tests | 8 | Yes | T05, T08, T13 |
| T22 | E2E workspace.e2e.ts | 8 | Yes | T09, T10 |
| T23 | E2E session.e2e.ts | 8 | Yes | T19 |

## Notes for the Coder

- **Start with T01–T03** before any main or renderer work — shared types prevent type divergence.
- **T06 and T11 are validation tasks** — they confirm live CLI behaviour against already-documented facts, not open-ended research. T07 may proceed in parallel once T06 starts. T12a is required and proceeds once T11 confirms the interactive mode works as documented.
- **T12a is required** — Option B (interactive stdin/stdout) is selected for M2. Do not skip T12a.
- **Extract `useWorkspaceState` from `AuthenticatedShell`** early in T09 — it will make T19 and T21 much easier.
- **All tasks with user-visible behavior changes require E2E coverage**. T09, T10, and T19 must each include or extend an E2E test. Do not mark them complete without `npm run test:e2e` passing.
- **Never store conversation text in the workspace JSON index**. The workspace file is paths only.
- **Never pass raw `workspacePath` from the renderer to `dialog.showOpenDialog`** — the path comes from the dialog result, not from renderer input.
