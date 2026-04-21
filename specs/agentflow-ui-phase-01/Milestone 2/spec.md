# Spec: Milestone 2

## Status

- **Created**: 2026-04-14
- **Status**: Draft
- **Author**: Architect
- **Scope**: Workspace creation, new Strategist chat, and previous session retrieval

## Summary

Milestone 2 activates the core workspace and session model of AgentFlow UI. Starting from the authenticated empty shell delivered in Milestone 1, users must be able to:

- add one or more local folders as named workspaces
- see prior Copilot CLI chat sessions tied to each workspace
- start a new Strategist chat inside a selected workspace
- send messages and receive streaming responses from Strategist
- open a prior session and continue the conversation

This is the first milestone where the product becomes genuinely usable for Product Owners. The chat surface introduced here is intentionally minimal — the agent selector and file-context features are deferred to Milestone 3.

## Users

- Product Owners who want to begin Strategist sessions tied to a project folder
- Copilot CLI users returning to prior sessions for context continuity

## Problem Statement

After Milestone 1, authenticated users land in an empty shell with a visible "Start a new project" action. Nothing happens when they click it, no workspaces or sessions exist, and the product cannot yet deliver any of its core value. Milestone 2 closes this gap by wiring the workspace and session model end-to-end.

The three user-facing problems this milestone solves:

1. There is no way to associate a project folder with the app or load its history
2. There is no way to begin a Strategist chat
3. There is no way to discover or revisit prior work

## Goals

- Make the workspace model real: users add folders, the left rail fills in, workspaces persist
- Surface Copilot CLI session history for the selected workspace without duplicating content
- Provide a functional, minimal chat interface for new and continued Strategist sessions
- Keep the Electron boundary clean: renderer never touches the filesystem or CLI directly

## Non-Goals

- Agent selector in the composer (Milestone 3)
- File-path context attachment (Milestone 3)
- Workspace removal or renaming
- Conversation-level agent handoff
- Workspace synchronization across machines
- Right-side artifact panel
- Notifications or background session watching

## Inputs

This spec is derived from:

- `specs/constitution.md`
- `specs/agentflow-ui-phase-01/product-requirements.md`
- `specs/agentflow-ui-phase-01/ui-spec.md`
- `specs/agentflow-ui-phase-01/user-stories/04-add-workspace-by-folder.md`
- `specs/agentflow-ui-phase-01/user-stories/05-start-strategist-chat-in-workspace.md`
- `specs/agentflow-ui-phase-01/user-stories/06-show-previous-sessions-for-workspace.md`
- `specs/agentflow-ui-phase-01/UX-Stories/04-workspace-sidebar-navigation-ux.md`
- `specs/agentflow-ui-phase-01/UX-Stories/05-session-list-and-restoration-ux.md`
- `specs/agentflow-ui-phase-01/UX-Stories/06-active-chat-and-composer-ux.md`
- `specs/agentflow-ui-phase-01/Milestone 1/spec.md`
- `specs/agentflow-ui-phase-01/Milestone 1/plan.md`

## Functional Requirements

### FR1: Workspace Folder Selection

The app must allow the user to add a local folder as a workspace.

- The existing "Start a new project" CTA (from the Milestone 1 empty shell) must trigger a native folder-picker dialog
- A `+` affordance in the left rail must also trigger folder selection once at least one workspace exists
- On folder cancellation, the app must return to the previous state with no side effects
- The app must use Electron's `dialog.showOpenDialog` from the main process, invoked via IPC
- The renderer must not access the filesystem directly

### FR2: Workspace Persistence

Workspace folder paths must persist across app restarts.

- Workspaces must be stored as a minimal JSON index in the Electron `userData` directory
- The index stores only the folder path and a display name (derived from the folder basename)
- No session content, conversation text, or auth data may be stored in this index
- The workspace list must be loaded on app startup and available before the user interacts with the sidebar
- Workspace entries are not removed unless a future capability explicitly supports removal (out of scope for M2)

### FR3: Workspace Navigation

The left rail must display the workspace list and support selection.

- Workspaces must appear as top-level items in the left rail, each using folder iconography
- The active (selected) workspace must be visually distinct from inactive workspaces
- Switching workspaces must update the session list to reflect the newly selected folder
- Multiple workspaces may be added; each must appear as a separate entry
- The workspace name displayed is the basename of the selected folder path

### FR4: Session Discovery

When a workspace is selected, the app must surface prior Copilot CLI sessions for that folder.

- The app must read Copilot CLI's local session storage to discover sessions associated with the selected workspace path
- Sessions must appear nested beneath the active workspace in the left rail
- Each session entry must show a scannable title — derived from available CLI metadata, falling back to a formatted timestamp
- If no sessions exist for the selected workspace, a calm empty state is shown rather than an error or blank gap
- Session discovery must not duplicate or re-store conversation content in the app's own storage

**Confirmed**: Copilot CLI stores sessions under `~/.copilot/session-state/<session-id>/events.jsonl` (JSONL format). Each session subdirectory contains an `events.jsonl` with records including `sessionId`, `timestamp`, `cwd` (the working directory when the session started), and `source`. An auxiliary SQLite index at `~/.copilot/session-store.db` supports cross-session queries. Session discovery must enumerate subdirectories of `~/.copilot/session-state/`, read each `events.jsonl`, and filter by matching `cwd` against the selected workspace path. A session title can be derived from a `/rename` event record if present, falling back to a formatted timestamp.

Source: [Copilot CLI configuration directory reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference#automatically-managed-files)

### FR5: New Strategist Chat

The user must be able to start a new chat session within the selected workspace.

- A "New chat" action must be available inside the selected workspace context (left rail or main panel)
- In phase 1, all new sessions are created with Strategist as the active agent — no agent configuration step is required
- Starting a new chat must transition the main panel to the active chat surface with an empty transcript
- The new session must be associated with the selected workspace folder
- The user must not be able to start a new chat if no workspace is selected

**Confirmed**: There is no `--workspace` or `--cwd` flag. Workspace context is captured implicitly via the child process working directory. The app must spawn `copilot --agent=strategist` with the process `cwd` set to the selected workspace folder path; the CLI records the `cwd` in session metadata automatically. For interactive sessions the process communicates via stdin/stdout; for single-turn programmatic invocations `copilot -p "PROMPT"` is also available.

Source: [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#command-line-options)

### FR6: Chat Surface

When a session is active, the main panel must provide a functional chat interface.

- The transcript region must occupy the majority of the main panel content area
- The composer must anchor to the bottom of the main panel
- The composer must contain a text input and a send action
- Strategist must be shown as the active agent in the composer as a static label (no agent selector in M2)
- User messages and Strategist responses must be visually distinct in the transcript
- Copilot CLI responses must stream progressively into the transcript as they arrive
- The composer must be disabled while a response is streaming
- File-context attachment is not included in the composer in this milestone

### FR7: Prior Session Restoration

The user must be able to open a prior session from the sidebar and continue the conversation.

- Selecting a prior session from the sidebar must open it in the main panel
- The transcript for a restored session must be sourced from Copilot CLI, not from a separate app-owned conversation store
- After restoration, the composer must be ready for new input
- The user must be able to send new messages to continue the restored session
- Switching from one workspace to another must close any active session and update the sidebar and main panel accordingly

**Confirmed**: To resume a specific prior session the app must spawn `copilot --resume=<session-id>` with the child process `cwd` set to the workspace folder; to resume the most recently closed session `copilot --continue` is available. The CLI restores the full conversation context automatically from the session's `events.jsonl`. The app may also reconstruct the transcript view by parsing the `events.jsonl` directly for display purposes, without duplicating content in app storage.

Source: [GitHub Copilot CLI — Resume an interactive session](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli#resume-an-interactive-session)

### FR8: Error and Edge-Case Handling

- Folder dialog cancellation must leave the workspace list unchanged
- If session discovery fails for a workspace (e.g., CLI directory unreadable), the app must show an inline error with a retry action rather than crashing or showing a blank state
- If a chat message fails to send (e.g., CLI process error), the app must surface an actionable error in the transcript area
- If a prior session cannot be restored (e.g., session file missing), the app must display a clear error and allow the user to return to the workspace view

## UX Requirements

### UXR1: Workspace Navigation (Left Rail)

- Workspaces must appear as top-level folder-like items in the left rail
- The `+` affordance must be discoverable in the workspace area without crowding existing entries
- The selected workspace must be visually highlighted but restrained — not in a way that overwhelms the session list beneath it
- Sessions must appear visually nested under the selected workspace, indented and lighter-weight than workspace labels
- The session list must update smoothly when the user switches workspaces; there must be no abrupt flash or stale-content moment
- The left rail must not behave like a file explorer — no expand/collapse trees, no drag-and-drop

### UXR2: Session List

- Session titles must be compact, scannable, and clearly clickable/selectable
- Timestamp or recency metadata may appear quietly alongside the title but must not compete with it
- Empty-state copy for a workspace with no sessions must guide the user toward starting a new chat without reading like an error
- The transition from no-sessions to first-session must be graceful — the empty state gives way to the first session entry without layout shifts

### UXR3: Active Chat Surface

- The transcript must be the visual focal point of the main panel
- When streaming, response text must appear progressively — no blank wait followed by a full dump
- User and Strategist messages must be visually distinct without relying on heavy bordered boxes for every turn
- The composer must feel integrated into the layout, not a floating overlay
- The agent label ("Strategist") in the composer must be readable but secondary to the text input
- The send action must be available but not oversized
- Utility actions must not compete with the transcript or composer during an active session

### UXR4: Workspace-Selected, No Active Session

- When a workspace without prior sessions is selected, the main panel must show a clear invitation to start a new chat — not an empty shell state that repeats the M1 "Start a new project" message
- When a workspace with prior sessions is selected and no session is open, the main panel must offer a clear "New chat" action alongside or in place of the session list summary

## Architectural Requirements

### AR1: IPC Boundary Preservation

All operations that touch the filesystem, Copilot CLI, or Electron APIs must be initiated from the main process via typed IPC.

- `listWorkspaces` — returns the persisted workspace list
- `addWorkspace` — opens the native folder dialog and persists the selected folder
- `listSessions(workspacePath)` — returns sessions for the given workspace
- `startNewSession(workspacePath)` — creates a new CLI session in the workspace context
- `openSession(sessionId)` — returns the transcript for a prior session
- `sendMessage(sessionId, text)` — sends a message and initiates streaming
- `chatOutput` (push channel) — delivers streaming text chunks to the renderer
- All new channels must be added to `src/shared/ipc.ts` and exposed via the preload bridge

### AR2: Shared Type Extensions

New types introduced in `src/shared/` must be typed at the boundary and reused across main, preload, and renderer without duplication:

- `Workspace { path: string; name: string }`
- `Session { id: string; title: string; workspacePath: string; createdAt?: string }`
- `ChatMessage { role: 'user' | 'assistant'; content: string }`

### AR3: Copilot CLI Adapter Extension

All session and chat invocations must go through the existing `CopilotCliAdapter` or a new co-located adapter in `src/infrastructure/copilot/`. The adapter is the only layer that knows how CLI processes are invoked or parsed.

### AR4: Workspace Persistence Isolation

The JSON workspace index must be read and written by a dedicated `WorkspaceService` in `src/main/` or `src/infrastructure/`. The renderer must never read or write this file directly.

### AR5: No Conversation Content Duplication

The app must not store full Copilot CLI conversation transcripts in its own persistence layer. Session transcripts are sourced live from the CLI on open. The app may cache transcript content transiently in renderer memory for the duration of the session, but must not write it to disk.

### AR6: Chat Process Lifecycle

Interactive CLI chat sessions involve spawning or maintaining a process with bidirectional IO. The main process owns all process lifecycle management. The renderer must only send and receive typed messages through IPC — it must not be aware of the underlying process.

## Acceptance Criteria

### Story: Add a Workspace by Folder

- **Given** the user is in the authenticated empty shell, **when** they click "Start a new project", **then** the app presents a native folder-picker dialog.
- **Given** the user selects a valid folder, **when** the selection is confirmed, **then** the folder appears as a workspace in the left rail.
- **Given** at least one workspace has been added, **when** the user views the left rail, **then** a "+" affordance is visible for adding additional workspaces.
- **Given** the user clicks "+", **when** they choose a new folder, **then** it is added to the workspace list without removing existing workspaces.
- **Given** a workspace has been added, **when** the user quits and relaunches the app, **then** that workspace is still present in the left rail.
- **Given** the folder-picker dialog is open, **when** the user cancels, **then** the workspace list is unchanged.

### Story: Show Previous Sessions for a Workspace

- **Given** the user selects a workspace with prior sessions, **when** the workspace is activated, **then** the session list appears nested under that workspace in the left rail.
- **Given** the user selects a workspace with no prior sessions, **when** the workspace is activated, **then** a calm empty-state message appears instead of a blank gap or error.
- **Given** prior sessions are listed, **when** the user selects one, **then** the main panel transitions to the restored session transcript.
- **Given** the user switches from one workspace to another, **when** the workspace changes, **then** the session list updates to reflect only the newly selected workspace.

### Story: Start a New Strategist Chat

- **Given** the user has selected a workspace, **when** they choose "New chat", **then** the main panel transitions to the chat surface with an empty transcript.
- **Given** a new chat is active, **when** the composer is shown, **then** Strategist is visible as the active agent (as a static label).
- **Given** no workspace is selected, **when** the user attempts to start a chat, **then** the action is not available.

### Story: Chat Interaction

- **Given** a session is active, **when** the user types a message and sends it, **then** the message appears in the transcript as a user turn.
- **Given** a message has been sent, **when** the Strategist response begins, **then** text streams progressively into the transcript.
- **Given** a response is streaming, **when** the user looks at the composer, **then** the send action is disabled.
- **Given** a response has finished, **when** the user looks at the composer, **then** it is ready to accept a new message.

### Story: Prior Session Restoration

- **Given** the user opens a prior session, **when** the session loads, **then** the prior conversation transcript is visible in the main panel.
- **Given** a prior session is open, **when** the user sends a new message, **then** the conversation continues without losing the prior context.

## Assumptions

- Copilot CLI session metadata (session ID, `cwd`, timestamp, title) is stored in `~/.copilot/session-state/<session-id>/events.jsonl`; this path applies on macOS and Linux; on Windows the `COPILOT_HOME` environment variable overrides the base directory
- Session titles can be derived from a `/rename` event in `events.jsonl`, falling back to a human-formatted timestamp
- Interactive chat sessions are started via `copilot --agent=strategist` (cwd = workspace path); session resumption uses `copilot --resume=<session-id>`
- The existing `StartupState` model and authenticated-shell transition from M1 remain unchanged
- Workspace folder paths are valid local directory paths on the current machine

## Validation Strategy

- Unit-test `WorkspaceService` CRUD operations and JSON serialization
- Unit-test session metadata parsing and title derivation
- Integration-test IPC handlers for `addWorkspace`, `listWorkspaces`, `listSessions`, `startNewSession`, `openSession`, `sendMessage` with mocked CLI output
- E2E smoke tests covering: workspace addition, session listing (mocked), new chat entry, and workspace persistence across restart
- Manual validation of the full chat flow against a real Copilot CLI session once the CLI contract is confirmed
