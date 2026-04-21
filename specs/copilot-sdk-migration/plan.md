# Implementation Plan: Copilot SDK Migration

## Status

- **Created**: 2026-04-20
- **Spec**: `specs/copilot-sdk-migration/spec.md`
- **Status**: Draft
- **Author**: Architect agent

## Technical Summary

This plan replaces the TTY-dependent `CopilotCliAdapter` chat path with `CopilotSdkProvider`, a new class that uses `@github/copilot-sdk` (`npm install @github/copilot-sdk`) to manage sessions and stream responses. The migration is structured around a `ChatProvider` interface that insulates `ChatService`, `SessionService`, and the IPC layer from any knowledge of the underlying backend. The interface is defined first; all other work depends on it. Auth and install-gate paths in `StartupService` are untouched.

The SDK's `CopilotClient` manages the Copilot CLI process lifecycle internally. The app holds one singleton client, creates named `CopilotSession` objects per chat session, streams response chunks via the `assistant.message_delta` event, and persists workspace association in a lightweight sidecar file alongside each session's SDK-managed directory.

## Architecture Decisions

### Decision 1: `ChatProvider` interface location

- **Context:** The interface must be importable from both `ChatService` (in `src/main/`) and `SessionService` (in `src/main/`), and from the concrete SDK provider (in `src/infrastructure/copilot/`). It must not create a circular import.
- **Options considered:** `src/shared/` (already used for cross-process types), `src/infrastructure/chat/` (new module under infra), `src/main/`
- **Chosen approach:** `src/infrastructure/chat/provider.ts`. Infrastructure is the right layer for integration-boundary abstractions. `src/shared/` is reserved for types crossing the IPC boundary (renderer ↔ main).
- **Spec reference:** US-4 (add new provider without UI/IPC changes)
- **Trade-offs:** One new directory under `src/infrastructure/`. Consistent with existing `src/infrastructure/copilot/` and `src/infrastructure/system/` patterns.

### Decision 2: `CopilotClient` lifecycle management

- **Context:** `CopilotClient` spawns the Copilot CLI process. It must be started once and stopped cleanly on app quit.
- **Options considered:** (A) create client in `CopilotSdkProvider` constructor with `autoStart: true`; (B) expose an explicit `init(): Promise<void>` method called from `src/main/index.ts`; (C) lazy init on first session creation.
- **Chosen approach:** Option A — `autoStart: true` in `CopilotClient` constructor options. The client starts the CLI process when instantiated. `CopilotSdkProvider` is instantiated synchronously in `src/main/index.ts` at app setup, before any IPC handlers are registered.
- **Spec reference:** Decision 8 in spec (singleton client lifecycle)
- **Trade-offs:** The CLI process is started even if the user never opens a chat session (after the auth gate). This is acceptable for phase 1. If startup overhead becomes a concern, lazy init can be added later without changing the interface.

### Decision 3: Workspace association via sidecar file

- **Context:** The SDK stores session data under `~/.copilot/session-state/<sessionId>/`. Because the Electron app has a fixed working directory (not the user's workspace path), all SDK sessions share the same `context.cwd` internal to the CLI. The SDK's `client.listSessions()` `context.cwd` filter cannot distinguish workspace-scoped sessions from other workspaces.
- **Options considered:** (A) App-managed registry file at `app.getPath('userData')/sessions.json`; (B) Sidecar file per session at `~/.copilot/session-state/<sessionId>/.agentflow-meta.json`; (C) Keep fs-based `listSessions` reading `events.jsonl` from disk.
- **Chosen approach:** Option B — sidecar file. It co-locates metadata with session data, is automatically cleaned up if the session directory is deleted, and avoids a separate registry file that can drift out of sync with the SDK's own session management.
- **Spec reference:** Decision 4 in spec (workspace association)
- **Trade-offs:** If the sidecar write fails (disk full, race), the session is invisible in future `listSessions` calls. This is logged but not a fatal error — the session remains accessible via the SDK directly.

### Decision 4: Strategist agent configuration

- **Context:** The SDK does not read `.codex/agents/strategist.toml`. The Strategist persona must be configured via the SDK's `systemMessage` option on `createSession`.
- **Options considered:** (A) Read and parse `.codex/agents/strategist.toml` at session creation time; (B) Bundle the Strategist prompt as a TypeScript string constant derived from the TOML content; (C) Use the SDK default model with no custom agent.
- **Chosen approach:** Option B — bundle the prompt as a string constant (`STRATEGIST_PROMPT`) in `CopilotSdkProvider`. Pass it via `systemMessage: { mode: 'replace', content: \`Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}\` }`. Using `mode: 'replace'` gives full control over the agent persona. TOML parsing at runtime adds a dependency and a file-not-found error path that is out of scope for the migration.
- **Evidence:** The documented `SessionConfig` has no `customAgents` or `agent` field. `systemMessage: { mode: 'replace', content: string }` is the documented approach for full system prompt control (SDK docs: "For full control (removes all guardrails), use `mode: \"replace\"`").
- **Spec reference:** Decision 5 in spec (Strategist agent definition)
- **Trade-offs:** The bundled prompt will drift from the TOML file if the TOML is updated. A future task should add TOML loading to keep them in sync.

### Decision 5: `SessionService` and `ChatService` both depend on `ChatProvider`

- **Context:** Currently `SessionService` has its own `CopilotCliAdapter` instance (`new CopilotCliAdapter()`). If `listSessions` is added to `ChatProvider`, `SessionService` can be updated to receive the provider via injection instead.
- **Options considered:** (A) Move `listSessions` into `ChatService`, eliminate `SessionService`; (B) Keep `SessionService` and update it to accept `ChatProvider`.
- **Chosen approach:** Option B — minimal structural change. `SessionService` receives `ChatProvider` via constructor injection alongside `ChatService`. Both are wired up in `src/main/index.ts` with the same `CopilotSdkProvider` instance.
- **Spec reference:** US-4 (interface-only dependency)
- **Trade-offs:** Two services hold a reference to the same provider instance. This is clean since the provider manages its own state internally.

### Decision 6: OAuth-based authentication with token persistence

- **Context:** The CLI-based `probeAuthState()` is unreliable and does not persist across app restarts. Every launch requires re-authentication via `copilot login`. The `@github/copilot-sdk` package supports OAuth-based authentication directly via `CopilotClientOptions.githubToken?: string`. OAuth tokens can be persisted by the app and loaded on startup.
- **Options considered:**
  - **(A)** Keep CLI probe + persist CLI session state (e.g., copy `~/.copilot` directory on logout)
  - **(B)** Use SDK OAuth device flow, persist token via Electron `safeStorage` to `app.getPath('userData')/auth.json`, load on startup → init `CopilotClient` with `githubToken` option
  - **(C)** Use `copilot auth status` CLI as auth check only, continue requiring `copilot login` for actual auth
- **Chosen approach:** Option B — OAuth device flow for login, token persisted via `safeStorage` to encrypted storage. On startup: load token → init `CopilotClient` with `githubToken` option → probe via `listSessions()`. Must verify exact option name from `CopilotClientOptions` type in `node_modules/@github/copilot-sdk/dist/types.d.ts` (T11 is a research-only task for this).
- **Evidence:** `CopilotClientOptions` has two auth-related fields:
  - `githubToken?: string` — "GitHub token to use for authentication. When provided, the token is passed to the CLI server via environment variable. This takes priority over other authentication methods."
  - `useLoggedInUser?: boolean` — "Whether to use the logged-in user for authentication. When true, the CLI server will attempt to use stored OAuth tokens or gh CLI auth. When false, only explicit tokens (githubToken or environment variables) are used. @default true (but defaults to false when githubToken is provided)."
- **Spec reference:** US-5 (OAuth-based authentication)
- **Trade-offs:**
  - Eliminates CLI dependency for login flow (only SDK + OAuth device code needed)
  - Logout requires clearing stored token and stopping the client
  - If the SDK does not support OAuth device flow directly, fallback is to use GitHub's OAuth device flow API (`https://github.com/login/device/code`) and pass the resulting token via `githubToken` option
  - Note: T11 must verify whether the SDK exposes a device flow helper or if the app must call the GitHub OAuth API directly

### Decision 7: Session naming via sidecar extension

- **Context:** Sessions in the sidebar currently show generic date/time labels (`new Date().toLocaleString()`). Users need to be able to name sessions for better identification. The sidecar file already stores `{ workspacePath, createdAt }` — it can be extended with `name?: string`.
- **Options considered:**
  - **(A)** Store names in a separate registry file at `app.getPath('userData')/session-names.json`
  - **(B)** Extend sidecar `SidecarData` to include `name?: string`
  - **(C)** Use SDK's `SessionMetadata.summary` field (read-only, auto-generated)
- **Chosen approach:** Option B — extend sidecar to include `name?: string`. New IPC channel `agentflow:rename-session` added. `SessionItem` component gets inline rename UI on title click (click → edit mode, press Enter → save via IPC, blur → cancel).
- **Spec reference:** US-6 (session naming)
- **Trade-offs:**
  - Sidecar write/read path already exists; no new registry file needed
  - If the sidecar is deleted, the custom name is lost (same trade-off as workspace association)
  - Name is purely app-managed, not visible to SDK or CLI

## Impacted Areas

| Area | Impact | Files / Modules Likely Affected |
|------|--------|---------------------------------|
| New infrastructure module | New file | `src/infrastructure/chat/provider.ts` |
| New SDK provider | New file | `src/infrastructure/copilot/sdk-provider.ts` |
| ChatService refactor | Constructor signature change | `src/main/chat-service.ts` |
| SessionService refactor | Constructor signature change | `src/main/session-service.ts` |
| DI wiring | Provider instantiation | `src/main/index.ts` |
| npm dependency | New package | `package.json`, `package-lock.json` |
| Unit tests (new) | New test file | `tests/infrastructure/copilot/sdk-provider.test.ts` |
| Unit tests (update) | Update existing | `tests/main/chat-service.test.ts`, `tests/main/session-service.test.ts` |
| E2E tests (new) | New test file | `tests/e2e/agent-execution.e2e.ts` |

**Not impacted:** `src/renderer/`, `src/preload/`, `src/shared/ipc.ts`, `src/shared/workspace-types.ts`, `src/main/startup-service.ts`, `src/infrastructure/copilot/adapter.ts` (auth path unchanged), `src/infrastructure/system/`

## Implementation Phases

### Phase 1: Define `ChatProvider` interface

**Goal:** Establish the contract that all other phases implement against. This is the foundation task — nothing else starts until it is merged.
**Prerequisite:** None

- [ ] Create `src/infrastructure/chat/provider.ts` exporting a `ChatProvider` interface with six methods:
  - `listSessions(workspacePath: string): Promise<Session[]>`
  - `startNewSession(workspacePath: string): Promise<Session>`
  - `openSession(sessionId: string): Promise<ChatMessage[]>`
  - `sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void>`
  - `closeSession(sessionId: string): void`
  - `closeAll(): void`
- [ ] Import `Session` and `ChatMessage` from `@shared/workspace-types` (no new types needed)
- [ ] No implementation code in this file — interface only

**Validation:** `npm run typecheck` passes. The file compiles with no imports from `CopilotCliAdapter`.

### Phase 2: Refactor `ChatService` and `SessionService`

**Goal:** Both service classes depend on `ChatProvider` rather than on the concrete adapter class. The IPC handlers in `src/main/index.ts` require no changes because the service method signatures are unchanged.
**Prerequisite:** Phase 1 complete

**`src/main/chat-service.ts`:**
- [ ] Replace `import { CopilotCliAdapter }` with `import type { ChatProvider } from '@infra/chat/provider'`
- [ ] Change constructor: `constructor(private readonly provider: ChatProvider)` — remove default arg
- [ ] Rename delegation calls from `this.copilot.*` to `this.provider.*`

**`src/main/session-service.ts`:**
- [ ] Replace `import { CopilotCliAdapter }` with `import type { ChatProvider } from '@infra/chat/provider'`
- [ ] Change constructor: `constructor(private readonly provider: ChatProvider)` — remove default arg
- [ ] `listSessions(workspacePath)` delegates to `this.provider.listSessions(workspacePath)`

**Validation:** `npm run typecheck` passes. Both service files have zero references to `CopilotCliAdapter`.

### Phase 3: Implement `CopilotSdkProvider`

**Goal:** A complete concrete implementation of `ChatProvider` backed by `@github/copilot-sdk`. All six interface methods are implemented. Auth and install-gate paths are not touched.
**Prerequisite:** Phase 1 complete (does not require Phase 2 to complete first)

**Install the package:**
```
npm install @github/copilot-sdk
```

**Create `src/infrastructure/copilot/sdk-provider.ts`:**

Key implementation notes per method:

**`startNewSession(workspacePath)`:**
1. Call `this.client.createSession({ streaming: true, model: 'gpt-4.1', systemMessage: { mode: 'replace', content: \`Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}\` }, onPermissionRequest: approveAll })`
2. Store the returned `CopilotSession` in `this.activeSessions` map keyed by `session.sessionId`
3. Write sidecar: `~/.copilot/session-state/${session.sessionId}/.agentflow-meta.json` with `{ workspacePath, createdAt: new Date().toISOString() }` — catch write failure, log only
4. Return `{ id: session.sessionId, title: new Date().toLocaleString(), workspacePath, createdAt }`

**`listSessions(workspacePath)`:**
1. Call `await this.client.listSessions()` — gets all SDK-managed sessions
2. For each `SessionMetadata`, attempt to read the sidecar file path `~/.copilot/session-state/${meta.sessionId}/.agentflow-meta.json`
3. If sidecar exists and `sidecar.workspacePath === normalizePath(workspacePath)`, include the session
4. Build `Session` from sidecar `createdAt` and SDK `meta.summary` (or formatted `meta.startTime`) as title
5. Return sorted by `createdAt` descending

**`openSession(sessionId)`:**
1. If session already in `activeSessions`, use it — otherwise call `await this.client.resumeSession(sessionId, { onPermissionRequest: approveAll })`
2. Store in `activeSessions`
3. Call `session.getMessages()` → returns `SessionEvent[]`
4. Filter for `event.type === 'user.message'` and `event.type === 'assistant.message'`; map to `{ role, content }`
5. Return `ChatMessage[]`, catch errors → return `[]`

**`sendMessage(sessionId, text, onData)`:**
1. Get session from `activeSessions`; if absent, lazy-resume via `client.resumeSession(sessionId, { onPermissionRequest: approveAll })` and store
2. Subscribe: `const unsub = session.on('assistant.message_delta', (e) => onData(e.data.deltaContent))`
3. Call `await session.sendAndWait({ prompt: text })`
4. In `finally`: call `unsub()`

**`closeSession(sessionId)`:**
1. Get from `activeSessions`, call `session.disconnect()` (async, fire-and-forget)
2. Delete from `activeSessions`

**`closeAll()`:**
1. Call `await this.client.stop()`
2. Clear `activeSessions`

**`STRATEGIST_PROMPT` constant:**
- Define as a module-level string constant: `const STRATEGIST_PROMPT = '<system prompt extracted from .codex/agents/strategist.toml>'`
- Must be a module-level constant — do not repeat it per method call
- The full content passed to `systemMessage` is: `\`Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}\``

**SDK client construction:**

```typescript
private readonly client = new CopilotClient({ autoStart: true });
private readonly activeSessions = new Map<string, CopilotSession>();
```

**Path helpers:** Use `path.join(os.homedir(), '.copilot', 'session-state', sessionId, '.agentflow-meta.json')`. Use `realpathSync` for workspace path normalization (same pattern as existing adapter).

**Validation:** `npm run typecheck` and `npm test` pass. Unit tests (Phase 5) cover all six methods with a mocked SDK client.

### Phase 4: Wire dependency injection in `src/main/index.ts`

**Goal:** Replace the implicit `new CopilotCliAdapter()` defaults in `ChatService` and `SessionService` with explicit construction using `CopilotSdkProvider`.
**Prerequisite:** Phases 2 and 3 complete

- [ ] Add import: `import { CopilotSdkProvider } from '@infra/copilot/sdk-provider'`
- [ ] Before service construction: `const chatProvider = new CopilotSdkProvider()`
- [ ] Change: `const chatService = new ChatService(chatProvider)`
- [ ] Change: `const sessionService = new SessionService(chatProvider)`
- [ ] The `before-quit` handler already calls `chatService.closeAll()` which delegates to `chatProvider.closeAll()` — no change needed

**Note:** `startupService` still constructs its own `CopilotCliAdapter` internally for auth probing. This is unchanged.

**Validation:** `npm run typecheck`, `npm run build`, and `npm run test:e2e` pass.

### Phase 5: Tests

**Goal:** Sufficient test coverage for all new code paths. Existing E2E tests must continue to pass. New E2E test covers the complete send-message flow.
**Prerequisite:** Phase 4 complete

**Unit tests — `tests/infrastructure/copilot/sdk-provider.test.ts`:**

Mock `@github/copilot-sdk` entirely. Test each `ChatProvider` method in isolation:
- `startNewSession`: SDK `createSession` called with correct args; sidecar write attempted; returned `Session` has correct shape
- `listSessions`: filters by sidecar workspace path; handles missing sidecars gracefully; returns empty array when no sessions match
- `openSession`: calls `resumeSession` when session not active; calls `getMessages`; maps event types correctly; returns `[]` on error
- `sendMessage`: subscribes to `assistant.message_delta`; calls `sendAndWait`; unsubscribes in `finally`; lazy-resumes if session not active
- `closeSession`: calls `disconnect`, removes from map
- `closeAll`: calls `client.stop`, clears map

**Unit tests — update `tests/main/chat-service.test.ts` and `tests/main/session-service.test.ts` (if they exist):**

Replace any `CopilotCliAdapter` mock with a mock `ChatProvider`. Verify delegation is unchanged.

**E2E test — `tests/e2e/agent-execution.e2e.ts`:**

Gated by `COPILOT_AUTHENTICATED=1` environment variable. Covers:
- Start a new session for a workspace path → session ID returned
- Send a message → `chatOutput` IPC events arrive before `sendMessage` resolves
- Open the session → transcript contains the sent message
- Close the session without error

**Validation:** `npm run typecheck`, `npm run lint`, `npm test`, and (with `COPILOT_AUTHENTICATED=1`) `npm run test:e2e` all pass.

## Test Strategy

- **Unit tests:** `CopilotSdkProvider` with full SDK mock. `ChatService` and `SessionService` with a mock `ChatProvider`. These run without network or Copilot CLI.
- **Integration tests:** Not required for this migration — the boundary under test is the SDK adapter itself, which is best covered by the unit layer with a mock and confirmed end-to-end by E2E.
- **E2E tests:** `agent-execution.e2e.ts` — requires `COPILOT_AUTHENTICATED=1`. Covers the full user-visible flow: session creation, message exchange, transcript retrieval. This test is the primary correctness gate for the SDK integration.
- **Manual verification:** First run with a real Copilot account to confirm agent persona and streaming UX.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK breaking change (public preview) | Medium | Medium | `ChatProvider` interface isolates the rest of the codebase; only `sdk-provider.ts` needs updating |
| `client.listSessions()` returns unexpected structure | Low | Low | Filter defensively; skip entries with missing fields; unit tests cover this path |
| Sidecar write race (session created but sidecar not written before `listSessions` is called) | Low | Low | Sidecar is written synchronously after session creation before returning to caller |
| SDK permission model blocks agent tool calls | Medium | High | `approveAll` is used for phase 1; if the agent requires specific tools, permissions are already granted |
| `CopilotClient` takes too long to start (CLI cold start) | Low | Medium | `autoStart: true` starts the client at app launch, before the user reaches the chat UI; warm by the time sessions are created |
| Strategist bundled prompt diverges from TOML | Low | Low | Noted in Decision 4; a future task adds TOML loading. The prompt is static for phase 1 |
| `sendAndWait` hangs if no `session.idle` event arrives | Low | High | Add a timeout parameter to `sendAndWait` (SDK supports this); default `120_000ms` matches current adapter `MAX_RESPONSE_MS` |

## Open Questions

None — all questions from the product requirements spec are resolved in `spec.md`.

---

## Pre-Implementation Gates

### Simplicity Gate
- [x] Is this the simplest approach that meets the spec requirements?
- [x] No speculative or "might need" features included (TOML loading, permission UI, provider switcher all deferred)
- [x] Using SDK directly without wrapping SDK types in extra abstractions

### Consistency Gate
- [x] Follows existing codebase patterns (DI via constructor, `@infra/` module path alias, kebab-case filenames)
- [x] Aligns with project constitution (Extensible by Design, Workspace-Centered Sessions)
- [x] One new directory (`src/infrastructure/chat/`) with clear justification

### Completeness Gate
- [x] Every spec requirement is addressed by at least one phase
- [x] Test strategy covers all acceptance criteria
- [x] Risks are identified with mitigations

## Plan Quality Checklist

- [x] Every technical decision traces to a spec requirement
- [x] Phases are ordered and have clear prerequisites
- [x] Impacted areas and file scope are identified
- [x] Test strategy is concrete, not generic
- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Plan aligns with project constitution
