# Product Requirements: copilot-sdk-migration

## Status

- **Created**: 2026-04-20
- **Status**: Draft
- **Author**: Strategist
- **Epic folder**: `specs/copilot-sdk-migration/`

## Epic Goal

Replace the broken CLI-based chat integration with the GitHub Copilot SDK and introduce a `ChatProvider` interface so future agents can be added without touching the UI.

## Current State

AgentFlow UI (phase 01, Milestone 2) implements chat by spawning `copilot --agent=strategist` as a child process and communicating via interactive stdin/stdout. The implementation is in `src/infrastructure/copilot/adapter.ts`.

This approach has reached a dead end:

- The Copilot CLI requires a TTY; it does not behave reliably when piped in headless Electron
- Startup output races with response detection: the CLI emits version banners and initialization text before the first prompt, making it impossible to reliably detect when the process is ready
- The interactive prompt pattern (`>` or `?`) used to detect end-of-response is fragile and fails in practice
- These are fundamental constraints of the CLI interface, not bugs that can be patched around

The rest of the application — the Electron shell, workspace model, session list, chat transcript, sidebar, and auth gate — is stable and usable. Only the chat integration layer is broken.

## Problem / Opportunity

The CLI-based chat integration is fundamentally incompatible with the headless, piped execution model that an Electron desktop app requires. GitHub provides the [Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started) as the intended programmatic interface for building Copilot-powered applications. The SDK is purpose-built for this use case and avoids all of the TTY, startup-race, and prompt-detection problems the CLI approach encounters.

This migration also surfaces a broader opportunity: the `adapter.ts` layer currently encodes tight coupling to Copilot CLI internals. Replacing it with a clean `ChatProvider` interface creates the extensibility the product needs to support additional agents (Codex CLI, Claude Code, or others) without restructuring the frontend or the IPC layer. Phase 1 ships one provider implementation; future agents implement the same interface.

## Users and Context

- **Who** benefits from this epic?  
  Developers and Product Owners using AgentFlow UI for Copilot Strategist sessions. In the future: users of any other agent that ships a provider implementation (Codex CLI, Claude Code, etc.).
- **When** do they encounter the problem this solves?  
  Every time they try to start or send a message in a chat session — the current integration is non-functional in Electron's headless environment.
- **What** do they currently do instead?  
  They cannot use the chat feature at all. The app authenticates and shows the workspace/session shell, but sending a message does not produce a reliable response.

## Intent and Philosophy

This epic exists to make the chat layer actually work, not to rebuild the product. The UI made the right choices; the integration layer picked the wrong interface. By replacing CLI process management with the SDK and wrapping it in a `ChatProvider` interface, the application regains a solid foundation while gaining the extensibility that phase 1 always implied — that new agents could be added without redesigning the core interaction model.

The `ChatProvider` interface is not over-engineering. It is the minimum boundary that prevents the frontend from ever caring which backend is running. Copilot SDK is implementation detail, not product identity.

## Scope

### In Scope

- Replace the CLI-based chat invocation in `src/infrastructure/copilot/adapter.ts` with the Copilot SDK
- Define a `ChatProvider` interface (in `src/infrastructure/` or `src/shared/`) that abstracts session creation, message sending, streaming response delivery, and prior session retrieval
- Implement `ChatProvider` for the Copilot SDK as the sole concrete provider for this epic
- Update session management if the SDK exposes session identity differently from the current `~/.copilot/session-state/` directory model
- Ensure auth probing (`isAuthenticated`) continues to work — either via SDK auth APIs or the existing CLI probe, whichever the SDK supports
- Retain the existing IPC channel names and payloads as far as the SDK allows, so that renderer and preload changes are minimal
- Maintain the install gate behavior: if the SDK cannot connect or authenticate, the user is shown the appropriate gate screen

### Out of Scope

- Implementing a Codex CLI provider (a future epic — only the interface is defined here)
- Implementing a Claude Code provider (a future epic)
- UI changes beyond what is strictly required to support the new provider model
- A provider switcher in the UI — provider selection is configuration, not a user-visible control in phase 1
- Replacing the workspace picker, session list layout, sidebar, or any other UI element that is not affected by the chat integration layer
- Removing the Copilot CLI install prerequisite if the SDK still requires it for auth

## Open Questions

These questions must be resolved in the Architect's spec before implementation begins.

- [ ] **SDK streaming**: Does the Copilot SDK expose streaming responses? If yes, what is the streaming API — async iterator, event emitter, callback? This determines how `chatOutput` push events are implemented.
- [ ] **Session identity**: Does the SDK expose a session ID? Is it compatible with the existing `~/.copilot/session-state/<session-id>/events.jsonl` structure, or is a new session identity model required?
- [ ] **Prior session history**: Can the SDK retrieve prior session transcripts, or must the app continue to read `events.jsonl` directly for session discovery and transcript display?
- [ ] **SDK auth**: Does the SDK provide its own authentication API that replaces `copilot auth status`, or does the existing CLI probe remain the right approach?
- [ ] **Package availability**: Is the Copilot SDK published as an npm package, and what Node.js / Electron version constraints does it impose?
- [ ] **Workspace context**: Does the SDK accept a workspace path (equivalent to the CLI's implicit `cwd` behavior), or is workspace association a concern the app must manage independently?
- [ ] **GHE support**: Does the SDK support GitHub Enterprise authentication, matching the GHE login flow the CLI supports?
- [ ] **Install gate**: If the SDK is self-contained and does not depend on the Copilot CLI binary, does the install gate still apply, or is it replaced by an SDK connectivity / auth gate?

## Success Criteria

- A user can start a new Strategist session in a selected workspace and exchange multiple messages with streaming responses — all via the SDK, with no CLI subprocess involved in the chat path
- A user can open a prior session from the sidebar and continue the conversation
- Adding a new provider in the future requires only implementing the `ChatProvider` interface and registering it — no changes to the renderer, preload, or IPC channel definitions are required
- The install gate and auth gate continue to correctly block or allow access based on SDK connectivity and auth state
- All existing Milestone 2 acceptance criteria continue to pass from a user-visible behavior perspective
