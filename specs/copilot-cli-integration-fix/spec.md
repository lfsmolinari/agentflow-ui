# Spec: Copilot CLI Integration Fix

## Status

- **Created**: 2026-04-14
- **Status**: Draft
- **Author**: Architect
- **Scope**: Redesign `startNewSession`, `sendMessage`, and session process lifecycle in the Copilot CLI adapter

## Summary

The current Copilot CLI integration is broken in production. `startNewSession` kills the CLI
process after getting a session ID, and `sendMessage` spawns a fresh `copilot --resume=<id>`
process for every message. This makes it impossible to distinguish history replay output from
actual new responses, and the idle-timer approach cannot reliably detect when a response is
complete.

This spec defines the requirements for a long-lived process-per-session model that resolves
both root causes.

## Users

- Product Owners and Copilot CLI users sending messages to Strategist via the desktop UI

## Problem Statement

Three compounding failures cause the current broken state:

1. **History replay contamination.** `sendMessage` spawns `copilot --resume=<id>` per turn,
   which replays all prior conversation history to stdout before accepting input. That replay
   output goes directly to the UI's `onData` callback and appears as if it were the new
   response.

2. **Unreliable end-of-response detection.** The 10-second idle timer fires whenever stdout
   goes quiet for 10 seconds. LLMs commonly pause 5–15 seconds mid-paragraph. The signal is
   too fragile and either cuts off in-progress responses or waits unnecessarily long.

3. **Startup race.** The 2-second fixed delay before writing to stdin is a guess; the CLI may
   not be ready in time, causing messages to be dropped silently.

## Goals

- Spawn the Copilot CLI process once per session and keep it alive across all messages
- Detect the CLI's ready-for-input prompt as a reliable end-of-response signal
- Ensure history replay output on `--resume` is never forwarded to the UI
- Kill processes cleanly when a session is closed or the app quits
- Preserve the existing IPC contract — renderer and preload changes are not in scope

## Non-Goals

- Changing the IPC contract (session creation, message sending, chat output channels remain
  identical)
- Supporting concurrent messages within one session
- Implementing agent switching or multi-agent sessions
- Modifying `openSession` (the events.jsonl read path is unaffected)
- Modifying `listSessions` (unaffected)
- Renderer-side ANSI rendering (follow-up concern, not this spec)

## Inputs

- `specs/constitution.md` — architecture principles and testing standards
- `specs/agentflow-ui-phase-01/Milestone 2/spec.md` — FR5 (new session), FR6 (streaming chat),
  FR7 (prior session restoration)
- `src/infrastructure/copilot/adapter.ts` — current broken implementation
- `src/infrastructure/system/interactive-command-runner.ts` — child process wrapper
- `src/main/chat-service.ts` — application service layer
- `src/main/index.ts` — IPC wiring

## Functional Requirements

### FR1: Long-Lived Process Per Session

When a new session is started, the CLI process must stay alive and be reused for all
subsequent messages in that session. The process must not be killed after session
initialization.

### FR2: Prompt-Based End-of-Response Detection

`sendMessage` must detect the CLI's input prompt appearing in stdout to determine when a
response is complete. The idle timer (if retained as a fallback) must be significantly shorter
than 10 seconds and must only start after at least one response chunk has been received, not
from the moment the message is sent.

### FR3: History Replay Suppression on Resume

When spawning `copilot --resume=<id>` for an existing session (lazy resume during
`sendMessage`), all output emitted before the first ready-prompt detection must be discarded
and must not be forwarded to the UI.

### FR4: Session Process Cleanup

- When the UI closes a session, the associated process must be terminated.
- When the app quits (any path: window close, Cmd-Q, SIGTERM), all active session processes
  must be terminated cleanly.

### FR5: Dead Session Recovery

If a session's process exits unexpectedly, the next `sendMessage` call must reject with a
descriptive error rather than hanging indefinitely. The error must surface to the UI as a
recoverable failure state.

### FR6: Lazy Resume for Prior Sessions

When a user opens a prior session via `openSession` and then sends a message, the adapter
must spawn `copilot --resume=<id>` lazily during `sendMessage`, wait for the process to reach
ready state (discarding all startup output), and then forward the message.

## Acceptance Criteria

- **AC1**: Sending a first message in a freshly started session returns a non-empty response
  with no prior history or startup text prepended.
- **AC2**: Sending a second message in the same session returns only the response to the
  second message — no prior turn content.
- **AC3**: Sending a message after opening a prior session (resume path) returns only the
  response to that message, not the prior conversation history.
- **AC4**: When the app quits, no orphaned `copilot` child processes remain running on the
  system.
- **AC5**: A real integration E2E test spawns the CLI, sends "hi", and asserts a non-empty
  response arrives.
- **AC6**: `~/.copilot/session-state/` has a new session directory after `startNewSession`
  completes.

## Assumptions

- The Copilot CLI emits a consistent prompt string (e.g., `> ` or `? `) when it is ready for
  input. The exact string must be confirmed empirically before finalizing the detection regex.
- The CLI's prompt appears at the end of a line (or on its own line), not embedded mid-word
  in response text.
- A session-per-process model is safe for the CLI (no shared-state conflicts between
  processes from different sessions).

## Open Implementation Notes

[NEEDS CLARIFICATION: What exact string does `copilot --agent=strategist` print to stdout
when it is ready for input? The Coder must observe this before implementing prompt detection.]

[NEEDS CLARIFICATION: When `copilot --resume=<id>` starts, does it print the prior
conversation history to stdout, or does it only print a prompt? The `--resume` startup
sequence must be empirically verified.]

[NEEDS CLARIFICATION: Does `copilot` emit ANSI escape codes in its prompt and response
output? If yes, ANSI stripping is required before prompt pattern matching.]

## Validation Strategy

- Unit tests: prompt detection helpers, mock-runner-based `startNewSession` / `sendMessage`
  lifecycle, `closeSession` / `closeAll`
- Integration E2E test: gated by `COPILOT_AUTHENTICATED=1`, spawns real CLI, sends "hi",
  asserts non-empty response
- Full validation suite: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
  `npm run test:e2e`
