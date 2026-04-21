# Feature Specification: Copilot SDK Migration

## Status

- **Created**: 2026-04-20
- **Status**: Draft
- **Author**: Architect agent

## Problem Statement

The current chat integration in `src/infrastructure/copilot/adapter.ts` drives Copilot by spawning `copilot --agent=strategist` as a child process and exchanging messages over interactive stdin/stdout. This approach is fundamentally incompatible with Electron's headless process model:

- The Copilot CLI requires a TTY; piped invocation produces unreliable behavior.
- CLI startup emits version banners and initialization text before the first prompt, causing output races that cannot be reliably resolved.
- End-of-response detection based on prompt patterns (`>`, `?`) is fragile and fails in practice.

These are architectural constraints of the CLI process model — not patchable bugs. The chat feature is non-functional as a result.

Additionally, the CLI-based authentication flow does not persist across app restarts. Users must re-authenticate via `copilot login` every time the app launches because:
- `probeAuthState()` creates a new CLI subprocess that can fail even with valid credentials (e.g., SDK SQLite DB cleared by re-login)
- There is no persistent auth state storage

## Users and Context

- **Who** is affected: every user of AgentFlow UI who attempts to start a chat session or send a message. The UI shell (workspaces, sidebar, auth gate) is stable; only the chat integration layer is broken.
- **When** they encounter it: any time the user sends a message or starts a new session. The app reaches the authenticated shell correctly but the chat path fails.
- **What** they do instead: they cannot use the chat feature at all.

Additionally, the current architecture hard-codes `CopilotCliAdapter` into `ChatService` and `SessionService`, making it impossible to add new providers without modifying both service classes.

## Proposed Solution

1. Define a `ChatProvider` interface that represents the full public surface of the chat integration layer.
2. Refactor `ChatService` and `SessionService` so each depends on `ChatProvider`, not on the concrete `CopilotCliAdapter`.
3. Implement `CopilotSdkProvider implements ChatProvider` using `@github/copilot-sdk` as the backend.
4. Wire the concrete provider in `src/main/index.ts` via constructor injection.

All IPC channels, renderer code, preload bindings, `Session` and `ChatMessage` types, and UI components remain unchanged. The provider boundary sits entirely within the main process.

## User Stories

### US-1: Start a new chat session and receive a streaming response

**As a** signed-in user with a workspace selected,
**I want to** start a new Strategist chat session and see the response stream in as it's generated,
**So that** I can begin product discussions without waiting for a full response before anything appears.

**Acceptance Criteria:**
- **Given** the user clicks "New chat" for a workspace, **when** `startNewSession` completes, **then** a `Session` with a valid `id`, `workspacePath`, and `createdAt` is returned and the session appears in the sidebar with a user-editable name.
- **Given** a session is active, **when** the user sends a message, **then** response text chunks are pushed via `onChatOutput` before the full response is complete.
- **Given** a session is active, **when** the agent finishes responding, **then** `sendMessage` resolves and no further chunks arrive.
- **Given** the SDK fails to create a session, **when** `startNewSession` throws, **then** an `{ error: string }` payload is returned to the renderer and no UI hang occurs.

### US-2: View prior sessions in the sidebar

**As a** signed-in user,
**I want to** see my prior chat sessions for the selected workspace in the left rail,
**So that** I can resume a prior conversation without starting from scratch.

**Acceptance Criteria:**
- **Given** a workspace is selected, **when** `listSessions` is called, **then** only sessions associated with that workspace path are returned.
- **Given** a workspace has no prior sessions, **when** `listSessions` is called, **then** an empty array is returned without an error.
- **Given** sessions exist for the workspace, **when** the sidebar renders, **then** each session has a user-editable name and is sorted by creation time descending.

### US-3: Continue a prior session

**As a** signed-in user,
**I want to** open a prior session and continue the conversation,
**So that** context from my earlier work is preserved.

**Acceptance Criteria:**
- **Given** a session ID from `listSessions`, **when** `openSession` is called, **then** a `ChatMessage[]` array representing the prior exchange is returned.
- **Given** an `openSession` call has completed, **when** the user sends a new message to that session ID, **then** the provider resumes the session context and delivers a response.
- **Given** an invalid or missing session ID, **when** `openSession` is called, **then** an empty array is returned and no error surfaces in the UI.

### US-4: Add a new provider without touching the UI or IPC layer

**As a** developer,
**I want to** add support for a new chat backend (e.g., Codex CLI, Claude Code) by implementing one interface,
**So that** no changes to the renderer, preload, IPC channel definitions, or service class signatures are required.

**Acceptance Criteria:**
- **Given** a new class implements `ChatProvider`, **when** it is registered in `src/main/index.ts`, **then** the full chat flow functions without any changes to the renderer, `src/preload/`, `src/shared/ipc.ts`, or `Session`/`ChatMessage` types.
- **Given** `ChatService` is constructed with any `ChatProvider` implementation, **when** the codebase is compiled, **then** TypeScript reports zero type errors for the service.

### US-5: Authenticate once and stay signed in across app restarts

**As a** user,
**I want to** authenticate with GitHub OAuth once and remain signed in when I restart the app,
**So that** I don't have to re-authenticate every time I launch AgentFlow.

**Acceptance Criteria:**
- **Given** the user completes OAuth device flow on first launch, **when** the app restarts, **then** the user is automatically signed in without seeing the login screen.
- **Given** the user clicks "Sign out", **when** they restart the app, **then** they see the login screen again.
- **Given** the stored OAuth token expires or is revoked, **when** the app starts, **then** the user sees the login screen with an error message indicating they need to re-authenticate.

### US-6: Name and rename chat sessions

**As a** user,
**I want to** assign meaningful names to my chat sessions,
**So that** I can quickly identify and resume the right conversation instead of parsing generic timestamps.

**Acceptance Criteria:**
- **Given** a session exists in the sidebar, **when** the user clicks the session title, **then** an inline text field appears for editing.
- **Given** the inline editor is open, **when** the user presses Enter or clicks away, **then** the new name is saved and displayed.
- **Given** a session has no custom name, **when** it is displayed in the sidebar, **then** a default timestamp-based name is shown.
- **Given** the user renames a session, **when** they close and reopen the app, **then** the custom name persists.

## Scope

### In Scope

- `ChatProvider` interface definition covering: `listSessions`, `startNewSession`, `openSession`, `sendMessage`, `closeSession`, `closeAll`
- `CopilotSdkProvider` as the concrete implementation using `@github/copilot-sdk`
- Refactoring `ChatService` and `SessionService` to depend on `ChatProvider`
- App-managed session metadata for workspace association (see Decision 4 below)
- Strategist agent persona configured via a bundled system prompt in the SDK provider (see Decision 5 below)
- Dependency injection wiring in `src/main/index.ts`
- Unit tests for `CopilotSdkProvider` (with SDK mocked) and for the refactored services
- E2E test for the complete send-message-receive-response flow

### Out of Scope

- Auth methods (`checkAuth`, `loginWithGitHub`, `loginWithEnterprise`, `logout`, `isInstalled`) — these remain in `StartupService` and `CopilotCliAdapter`; they are not part of `ChatProvider`
- Any UI, renderer, or preload change
- Changes to `Session` or `ChatMessage` types in `src/shared/workspace-types.ts`
- Changes to IPC channel names or payloads in `src/shared/ipc.ts`
- Implementing a Codex CLI or Claude Code provider (future epic; only the interface ships here)
- A provider switcher in the UI
- Parsing TOML agent definition files at runtime (Strategist prompt is bundled in the provider for phase 1)
- Session deletion UI
- GHE-specific auth changes — GHE auth continues to work via the existing CLI probe without modification

## Resolved Open Questions

### Decision 1: SDK streaming model

**Decision:** Use `assistant.message_delta` event for streaming; `session.idle` signals completion; use `sendAndWait()` as the primary send API.

Because the SDK's `sendAndWait()` resolves only after `session.idle` fires, and `assistant.message_delta` events deliver `deltaContent` chunks incrementally, this maps directly onto the existing `onData: (chunk: string) => void` callback signature in `sendMessage`. No changes to IPC or renderer are needed. The `streaming: true` flag is set on `createSession`.

### Decision 2: Session identity

**Decision:** Use the SDK's `session.sessionId` directly as `Session.id`. No transformation is needed.

The SDK's `CopilotSession.sessionId` is a string compatible with the existing `Session.id: string` field. The SDK stores session state under `~/.copilot/session-state/<sessionId>/`, the same root the current adapter reads. Session IDs from `client.listSessions()` are the same strings used to `resumeSession()`.

### Decision 3: Prior session transcript retrieval

**Decision:** Use `client.resumeSession(sessionId)` then `session.getMessages()` to reconstruct transcript. The `events.jsonl` parsing in `openSession` is replaced entirely.

The SDK's `getMessages()` returns typed `SessionEvent[]`. Events of type `user.message` and `assistant.message` are mapped to `{ role: 'user' | 'assistant', content: string }`. This eliminates the fragile JSONL parsing and the manual path-traversal security check in the current adapter.

### Decision 4: Workspace association for session listing

**Decision:** The `CopilotSdkProvider` writes an app-managed sidecar file immediately after creating a session. `listSessions` uses this sidecar to filter by workspace path.

**Rationale:** The SDK starts its CLI process with the Electron app's working directory (not the user's workspace path), so all sessions share the same `context.cwd` in SDK metadata. The SDK's `listSessions` filter cannot distinguish workspace-scoped sessions. An app-managed sidecar avoids this: immediately after `client.createSession()` returns, the provider writes `~/.copilot/session-state/<sessionId>/.agentflow-meta.json` containing `{ workspacePath, createdAt }`. `listSessions` calls `client.listSessions()` to enumerate valid session IDs, then reads each sidecar to filter by `workspacePath`. Sessions without a sidecar (created outside the app) are excluded.

**Accepted trade-off:** If the sidecar is manually deleted, the session disappears from the sidebar. This matches user expectation and avoids accidental cross-workspace session exposure.

### Decision 5: Strategist agent definition

**Decision:** The `CopilotSdkProvider` bundles the Strategist system prompt as a string constant (`STRATEGIST_PROMPT`) and passes it via `systemMessage: { mode: 'replace', content: ... }` on `createSession`. The workspace path is prepended into the content string.

**Evidence:** The documented `SessionConfig` fields are: `sessionId`, `model`, `reasoningEffort`, `tools`, `systemMessage`, `infiniteSessions`, `provider`, `onPermissionRequest`, `onUserInputRequest`, `onElicitationRequest`, `hooks`. There is no `customAgents` or `agent` field in the documented API. `systemMessage.mode: "replace"` gives full control over the system prompt.

**Rationale:** The SDK does not read `.codex/agents/` TOML files — those are Codex-specific. Using `systemMessage: { mode: 'replace', content: STRATEGIST_PROMPT }` gives full control over the agent persona. For phase 1, the Strategist prompt is sourced from the existing `.codex/agents/strategist.toml` definition, extracted and embedded as a string constant at implementation time. TOML parsing at runtime is deferred to a future task.

The workspace path is prepended in the full content: `"Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}"`.

### Decision 6: SDK authentication

**Decision:** SDK auth piggybacks on the existing Copilot CLI login. No new auth flow is implemented. `CopilotClient` uses `useLoggedInUser: true` (the SDK default). The install gate and login screen remain driven by `StartupService` and the existing CLI probe.

**Evidence:** GitHub docs state: "Follow the instructions at Installing GitHub Copilot CLI to install and authenticate with GitHub Copilot CLI. This will allow the SDK to access your GitHub account and use Copilot." `CopilotClientOptions.useLoggedInUser?: boolean` defaults to `true`. A separate `githubToken` option exists but is not needed for our use case.

The SDK requires Copilot CLI to be installed and authenticated. If the CLI is not authenticated, SDK session creation fails. This maps to the same failure mode as the current CLI-based chat — the install gate correctly blocks the path before the user reaches the chat UI.

### Decision 7: npm package and Node.js compatibility

**Decision:** Install `@github/copilot-sdk` (v0.2.2 at time of writing) via `npm install @github/copilot-sdk`. The SDK explicitly requires Node.js >= 18.0.0; the current Electron version uses Node 18+. No version conflicts are expected.

**Evidence:** npm package page confirms: package name `@github/copilot-sdk`, version `0.2.2`, Requirements section states "Node.js >= 18.0.0". Electron main process compatibility is `[UNVERIFIED — requires SDK install]` (no CLI incompatibilities noted; SDK uses stdio transport which is standard Node.js).

Note: The SDK is in public preview and may introduce breaking changes. The `ChatProvider` interface insulates the rest of the codebase from SDK volatility — a breaking SDK update only requires changes to `CopilotSdkProvider`.

### Decision 8: CopilotClient lifecycle

**Decision:** A single `CopilotClient` instance is created once during app startup (`autoStart: true`) and stopped in the `before-quit` handler via `closeAll()`.

**Rationale:** Creating one client per session or per workspace would spawn multiple CLI processes, which is wasteful and unsupported. The SDK supports multiple concurrent sessions per client. A singleton client aligns with how the existing adapter manages a single interactive process.

### Decision 9: Permission handling

**Decision:** Use `approveAll` for all tool calls on every `createSession` and `resumeSession`.

**Rationale:** This is a trusted desktop application where the user is already authenticated via their GitHub account. The agent is operating in the user's own workspace. Fine-grained permission control is a future enhancement.

## Edge Cases and Error Scenarios

- **Session creation fails (SDK error):** `startNewSession` throws; the IPC handler catches it and returns `{ error: string }` to the renderer. No session is added to the sidebar.
- **`openSession` called with an unknown session ID:** `client.resumeSession()` may throw. The provider catches and returns `[]`. The chat panel shows an empty transcript.
- **`sendMessage` called without a prior `openSession` or `startNewSession`:** The provider lazily resumes the session. If `resumeSession` fails, `sendMessage` throws; the IPC handler returns `{ error: string }`.
- **App quits with active sessions:** `before-quit` calls `closeAll()`, which calls `client.stop()`. All active `CopilotSession` objects are disconnected gracefully. SDK data is preserved on disk.
- **SDK produces no `assistant.message_delta` events (streaming off or SDK change):** `sendAndWait()` still resolves on `session.idle`. `onData` is never called. The renderer eventually receives the full message via a single `chatOutput` event or displays a blank response. This is a degraded-but-not-hung state.
- **Sidecar write fails (disk full, permissions):** `startNewSession` logs the error and returns the session without a sidecar. The session will not appear in future `listSessions` calls. The user can still continue the session within the same app lifetime.
- **Sidecar read fails during `listSessions`:** That session entry is silently skipped. Other sessions continue to list normally.

## Success Criteria

- A user can start a new Strategist session in a selected workspace and exchange multiple messages with streaming response chunks visible in the transcript.
- A user can see prior sessions in the sidebar scoped to the selected workspace.
- A user can open a prior session and continue the conversation.
- Adding a new provider in a future epic requires implementing `ChatProvider` only — no changes to `src/renderer/`, `src/preload/`, `src/shared/ipc.ts`, or `Session`/`ChatMessage` types.
- All Milestone 2 user-visible acceptance criteria continue to pass.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e` all pass after the migration.

---

## Spec Quality Checklist

- [x] Problem statement is clear and specific
- [x] User stories cover primary use cases
- [x] Every user story has testable acceptance criteria
- [x] No `[NEEDS CLARIFICATION]` markers remain — all open questions are resolved with explicit decisions
- [x] Edge cases and error scenarios are addressed
- [x] In-scope and out-of-scope are defined
- [x] Success criteria are measurable
- [x] Spec aligns with project constitution
- [x] No implementation details are included
