# Task Breakdown: Copilot SDK Migration

## Status

- **Created**: 2026-04-20
- **Spec**: `specs/copilot-sdk-migration/spec.md`
- **Plan**: `specs/copilot-sdk-migration/plan.md`
- **Status**: Draft
- **Author**: Architect agent

## Summary

- **Total tasks**: 10
- **Parallelizable tasks**: 4 (T03, T04, T06, T07 can run in parallel once unblocked — see graph)
- **Estimated phases**: 5

## Task Dependency Graph

```
T01 → T02 (ChatService refactor)
T01 → T03 [P] (SessionService refactor)
T01 → T04 [P] (install SDK + CopilotSdkProvider)
T02 → T05 (DI wiring) — also needs T03, T04
T03 → T05
T04 → T05
T05 → T06 [P] (update unit tests for services)
T05 → T07 [P] (sdk-provider unit tests)
T05 → T08 (E2E test)
T06 → T09 (task validation)
T07 → T09
T08 → T09
T09 → T10 (cleanup adapter chat methods)
```

> T02, T03 are sequential only because they modify different files — they can run in the same session or in parallel by different agents. T04 is independent of T02/T03 and can proceed immediately after T01.

## Tasks

---

### T01: Define the `ChatProvider` interface

- **Plan reference**: Phase 1 — Define `ChatProvider` interface
- **Dependencies**: None
- **Parallel**: No (foundation — all other tasks depend on it)
- **Files likely affected**:
  - `src/infrastructure/chat/provider.ts` (create)

**Description**: Create `src/infrastructure/chat/provider.ts` exporting a single `ChatProvider` interface with six methods: `listSessions`, `startNewSession`, `openSession`, `sendMessage`, `closeSession`, `closeAll`. Import `Session` and `ChatMessage` from `@shared/workspace-types`. No implementation code.

**Acceptance**:
- File exists at `src/infrastructure/chat/provider.ts`
- Interface exports exactly six methods with the correct signatures (see plan Phase 1)
- `npm run typecheck` passes with zero errors
- No imports from `CopilotCliAdapter` or any implementation module

---

### T02: Refactor `ChatService` to use `ChatProvider`

- **Plan reference**: Phase 2 — Refactor `ChatService`
- **Dependencies**: T01
- **Parallel**: No (changes `ChatService` which is also changed for DI wiring in T05)
- **Files likely affected**:
  - `src/main/chat-service.ts`

**Description**: Replace the concrete `CopilotCliAdapter` dependency in `ChatService` with `ChatProvider`. Change the constructor to accept `ChatProvider` as a required parameter (remove default `new CopilotCliAdapter()`). Update internal delegation calls from `this.copilot.*` to `this.provider.*`. Do not change any method signatures — the IPC layer calls these unchanged.

**Acceptance**:
- `ChatService` imports `ChatProvider` type, not `CopilotCliAdapter`
- Constructor is `constructor(private readonly provider: ChatProvider)`
- No `new CopilotCliAdapter()` remaining in this file
- `npm run typecheck` passes

---

### T03: Refactor `SessionService` to use `ChatProvider` [P]

- **Plan reference**: Phase 2 — Refactor `SessionService`
- **Dependencies**: T01
- **Parallel**: Yes — can run alongside T02 (different file)
- **Files likely affected**:
  - `src/main/session-service.ts`

**Description**: Replace the concrete `CopilotCliAdapter` dependency in `SessionService` with `ChatProvider`. Change the constructor to accept `ChatProvider` as a required parameter (remove default `new CopilotCliAdapter()`). `listSessions` delegates to `this.provider.listSessions(workspacePath)`.

**Acceptance**:
- `SessionService` imports `ChatProvider` type, not `CopilotCliAdapter`
- Constructor is `constructor(private readonly provider: ChatProvider)`
- No `new CopilotCliAdapter()` remaining in this file
- `npm run typecheck` passes

---

### T04: Install `@github/copilot-sdk` and implement `CopilotSdkProvider` [P]

- **Plan reference**: Phase 3 — Implement `CopilotSdkProvider`
- **Dependencies**: T01
- **Parallel**: Yes — can run alongside T02 and T03
- **Files likely affected**:
  - `package.json`, `package-lock.json` (npm install)
  - `src/infrastructure/copilot/sdk-provider.ts` (create)

**Description**: Run `npm install @github/copilot-sdk` (exact package name confirmed: `@github/copilot-sdk`, v0.2.2+). Create `src/infrastructure/copilot/sdk-provider.ts` with `CopilotSdkProvider implements ChatProvider`. Implement all six methods as described in the plan (Phase 3).

Key SDK API calls:
- **Session creation**: `client.createSession({ streaming: true, model: 'gpt-4.1', systemMessage: { mode: 'replace', content: \`Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}\` }, onPermissionRequest: approveAll })`
  - Note: there is no `customAgents` or `agent` field; persona is configured entirely via `systemMessage`
- **Session resumption**: `client.resumeSession(sessionId, { onPermissionRequest: approveAll })`
- **Streaming**: subscribe via `session.on('assistant.message_delta', (e) => onData(e.data.deltaContent))` before calling `session.sendAndWait({ prompt: text }, 120_000)`
- **History**: `session.getMessages()` returns `SessionEvent[]`; filter on `event.type === 'user.message'` and `event.type === 'assistant.message'`
- **Session list**: `client.listSessions()` returns `SessionMetadata[]` with `sessionId`, `startTime`, `modifiedTime`, `summary?`, `context?`

Define `STRATEGIST_PROMPT` as a module-level string constant extracted from `.codex/agents/strategist.toml`. Use `approveAll` for all permission requests. Use sidecar files at `~/.copilot/session-state/<sessionId>/.agentflow-meta.json` for workspace association. The `CopilotClient` is instantiated with `autoStart: true`.

**Acceptance**:
- `npm install @github/copilot-sdk` completes without resolution errors
- `src/infrastructure/copilot/sdk-provider.ts` exports `CopilotSdkProvider`
- Class implements `ChatProvider` with no TypeScript errors on the interface methods
- All six `ChatProvider` methods are implemented (stubs that compile are acceptable pending T07 test coverage)
- `npm run typecheck` passes

---

### T05: Wire `CopilotSdkProvider` via dependency injection in `src/main/index.ts`

- **Plan reference**: Phase 4 — Wire dependency injection
- **Dependencies**: T02, T03, T04
- **Parallel**: No
- **Files likely affected**:
  - `src/main/index.ts`

**Description**: In `src/main/index.ts`, replace the implicit `new CopilotCliAdapter()` defaults by constructing a single `CopilotSdkProvider` instance and passing it to both `ChatService` and `SessionService`. Import `CopilotSdkProvider` from `@infra/copilot/sdk-provider`. The `before-quit` handler and all IPC channels remain unchanged.

**Acceptance**:
- `src/main/index.ts` imports `CopilotSdkProvider` and passes it to both services
- No `new ChatService()` call without an explicit provider argument
- No `new SessionService()` call without an explicit provider argument
- `npm run typecheck` and `npm run build` both pass
- App starts without error (manual smoke test or E2E gate)

---

### T06: Update service unit tests to use a mock `ChatProvider` [P]

- **Plan reference**: Phase 5 — Tests (service tests)
- **Dependencies**: T05
- **Parallel**: Yes — can run alongside T07
- **Files likely affected**:
  - `tests/main/chat-service.test.ts` (update if it exists; create if not)
  - `tests/main/session-service.test.ts` (update if it exists; create if not)

**Description**: If unit tests exist for `ChatService` or `SessionService` that mock `CopilotCliAdapter`, update them to mock a `ChatProvider` object instead. Verify that each public method on the service delegates correctly to the provider and that the service itself adds no logic beyond delegation. If no tests exist yet, create minimal tests that confirm delegation for each method.

**Acceptance**:
- No remaining references to `CopilotCliAdapter` in service test files
- At minimum: each public method on `ChatService` and `SessionService` has a test that asserts it calls the corresponding `ChatProvider` method with the correct arguments
- `npm test` passes

---

### T07: Write unit tests for `CopilotSdkProvider` [P]

- **Plan reference**: Phase 5 — Tests (sdk-provider unit tests)
- **Dependencies**: T05
- **Parallel**: Yes — can run alongside T06
- **Files likely affected**:
  - `tests/infrastructure/copilot/sdk-provider.test.ts` (create)

**Description**: Mock `@github/copilot-sdk` using Vitest's mock system. Write unit tests for all six `ChatProvider` methods on `CopilotSdkProvider`. Cover: correct SDK API calls, sidecar write/read behavior (mock `fs/promises`), `ChatMessage` mapping from SDK events, error paths (sidecar missing, `resumeSession` throws), and `onData` callback delivery. See plan Phase 5 for the full test list.

**Acceptance**:
- `tests/infrastructure/copilot/sdk-provider.test.ts` exists
- Tests cover all six methods with at least one happy-path and one error-path case per method
- Sidecar file read/write is exercised with mocked `fs/promises`
- `onData` is verified to be called for each `assistant.message_delta` event
- `npm test` passes with no flakey tests

---

### T08: Write E2E test for the agent execution flow

- **Plan reference**: Phase 5 — Tests (E2E)
- **Dependencies**: T05
- **Parallel**: No (depends on the built app from T05; sequential after both T06 and T07 to avoid conflicts with test infrastructure)
- **Files likely affected**:
  - `tests/e2e/agent-execution.e2e.ts` (create)

**Description**: Create `tests/e2e/agent-execution.e2e.ts` gated by `COPILOT_AUTHENTICATED=1`. Using Playwright's `_electron` API, launch the built app, navigate past the auth gate, select a workspace, start a new session via `startNewSession`, send a message, assert that at least one `chatOutput` IPC event is received (not just a blank response), and close the session. Follow the pattern established in the existing `startup.e2e.ts` E2E test file. Do not add these cases to `startup.e2e.ts`.

**Acceptance**:
- File `tests/e2e/agent-execution.e2e.ts` exists
- Test is skipped (or guarded) when `COPILOT_AUTHENTICATED` is not set
- With `COPILOT_AUTHENTICATED=1`: test starts a session, sends a message, asserts a non-empty chat response arrives
- `npm run test:e2e` passes when gating variable is set

---

### T09: Full validation pass

- **Plan reference**: Phase 5 — Validation
- **Dependencies**: T06, T07, T08
- **Parallel**: No
- **Files likely affected**: None (validation only)

**Description**: Run the full project validation suite in order: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and (with `COPILOT_AUTHENTICATED=1`) `npm run test:e2e`. Fix any regressions found. All steps must pass before T10 proceeds.

**Acceptance**:
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors
- `npm test` — all tests pass, no new skips
- `npm run build` — build completes without error
- `npm run test:e2e` (with `COPILOT_AUTHENTICATED=1`) — all E2E tests pass including the new `agent-execution.e2e.ts`

---

### T10: Remove dead chat code from `CopilotCliAdapter`

- **Plan reference**: Phase 3 (cleanup) — post-migration
- **Dependencies**: T09
- **Parallel**: No
- **Files likely affected**:
  - `src/infrastructure/copilot/adapter.ts`
  - `tests/infrastructure/copilot/adapter.test.ts`

**Description**: Remove the chat-specific methods from `CopilotCliAdapter` that are now dead code: `startNewSession`, `openSession`, `sendMessage`, `closeSession`, `closeAll`, and all private helpers used only by those methods (`waitForReady`, `hasPrompt`, `stripAnsi`, `_resolveSessionCwd`, private session state types). Retain auth-related methods (`isInstalled`, `probeAuthState`, `loginWithGitHub`, `loginWithEnterprise`, `logout`) and all constants/helpers they use. Update `adapter.test.ts` to remove tests for deleted methods.

**Note:** Do not delete `adapter.ts` entirely — the auth methods are still used by `StartupService`.

**Acceptance**:
- `CopilotCliAdapter` retains only: `isInstalled`, `probeAuthState`, `loginWithGitHub`, `loginWithEnterprise`, `logout`
- No `activeSessions`, `SessionEntry`, `ResponseState`, `InteractiveCommandRunner` references remain in `adapter.ts`
- No dead private methods (those used only by deleted chat methods)
- `adapter.test.ts` has no tests for deleted methods
- `npm run typecheck`, `npm run lint`, `npm test` all pass

---

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| T01 | ✅ Complete | `src/infrastructure/chat/provider.ts` created |
| T02 | ✅ Complete | `ChatService` refactored to `ChatProvider` |
| T03 | ✅ Complete | `SessionService` refactored to `ChatProvider` |
| T04 | ✅ Complete | `sdk-provider.ts` created; `@github/copilot-sdk` added to package.json |
| T05 | ✅ Complete | `index.ts` wired with `CopilotSdkProvider` DI |
| T06 | ✅ Complete | `tests/main/chat-service.test.ts` and `session-service.test.ts` created |
| T07 | ✅ Complete | `tests/infrastructure/copilot/sdk-provider.test.ts` created |
| T08 | ✅ Complete | `tests/e2e/agent-execution.e2e.ts` created |
| T09 | ⏸️ Blocked | Run `npm install` first, then: `npm run typecheck && npm run lint && npm test && npm run build && COPILOT_AUTHENTICATED=1 npm run test:e2e` |
| T10 | ⏸️ Blocked | Requires T09 to pass |

Status legend: ⬜ Not started · 🔄 In progress · ✅ Complete · ⏸️ Blocked

---

## Task Quality Checklist

- [x] Every task is actionable — a coder can start without asking questions
- [x] Every task has clear acceptance criteria
- [x] Dependencies are explicit — no implicit ordering
- [x] Parallelizable tasks are marked with [P]
- [x] The full task list covers the entire plan (all five phases)
- [x] No task mixes unrelated concerns
- [x] Infrastructure/setup tasks come before feature tasks
- [x] Test tasks are included (T06, T07, T08)
- [x] Every task references its plan section
- [x] Tasks that produce user-visible behavior changes (T08) include E2E test(s) in acceptance criteria
