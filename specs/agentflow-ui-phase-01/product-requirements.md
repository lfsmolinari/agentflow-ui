# Product Requirements: agentflow-ui-phase-01

## Status

- **Created**: 2026-04-10
- **Status**: Draft
- **Author**: Strategist (init-sdd)
- **Epic folder**: `specs/agentflow-ui-phase-01/`

## Epic Goal

Deliver the first usable version of an Electron-based desktop UI for Copilot CLI focused on Product Owners using the Strategist agent, while establishing an extensible workspace and agent selector model for future agents.

## Current State

The repository is at the beginning of the project and does not yet contain application code, UI components, or a shipped desktop experience. What exists today is a set of agent definitions under `.codex/agents/`, including Strategist, Orchestrator, and Architect, which provide the conceptual model for the product. There is no current interface for users to launch a desktop client, authenticate through Copilot CLI, browse workspaces, start chat sessions, or switch between agent roles.

## Problem / Opportunity

Product Owners and other planning-oriented Copilot CLI users need a simpler, more visual way to work with specialist agents than a terminal-only experience provides. The core opportunity is not merely to put a GUI around Copilot CLI, but to make workspace context and agent identity visible and intentional in the product experience through a Codex-Desktop-like layout: workspace navigation on the left, prior chat sessions tied to the selected folder, chat in the center, and clear agent identity within each session. Phase 1 should validate that Strategist can be genuinely useful in that environment while the UI already communicates that a broader multi-agent model exists.

## Users and Context

- **Who** benefits from this epic?
  Product Owners first, followed by Copilot CLI users who want a desktop-based chat experience with specialist agents.
- **When** do they encounter the problem this solves?
  When they want to refine product requirements, draft user stories, and collaborate with Strategist in a more guided and visual interface than the CLI alone provides.
- **What** do they currently do instead (workaround, manual process, nothing)?
  They use Copilot CLI directly, rely on terminal-based interaction patterns, or use other chat interfaces that do not expose the same agent-oriented workflow model.

## Intent and Philosophy

This epic exists to make agent collaboration more natural and accessible for Copilot CLI users, not just to wrap CLI functionality in a new shell. It expresses the belief that agent choice should be a visible, intentional part of the product experience, with Strategist proving the value of the model for Product Owners first. The phase 1 product should feel like a simple desktop workspace inspired by Codex Desktop, but grounded in Copilot CLI as the backend and designed to grow into additional specialist agents over time.

## Scope

### In Scope

- A first desktop UI experience oriented around chat with the Strategist agent for Product Owner workflows
- A visible agent selector that shows additional agents but keeps them unavailable and not selectable in phase 1
- An Electron-based desktop shell using Copilot CLI as the backend runtime
- A frontend styling approach based on Tailwind CSS, CSS-variable-driven design tokens, and Radix primitives for accessible interactive controls
- A Codex-Desktop-inspired layout with workspace navigation, prior session retrieval per workspace folder, new chat/session entry points, and a central chat interface
- Support for Copilot-style chat affordances such as referencing file paths from the chat experience
- A splash or entry experience that presents application branding and:
  detects whether Copilot CLI is installed
  links users to install instructions when it is missing
  tells users to restart the app after installation
  guides users through authenticating with GitHub or GitHub Enterprise through Copilot CLI when installed
- Session continuity built on Copilot CLI capabilities such as continuing prior sessions rather than inventing a separate persistence model first
- A workspace model where a folder is treated as a project context and a new session is a new chat within that folder

### Out of Scope

- Full support for all planned agents in phase 1
- Conversation-level handoff between agents inside a single thread in phase 1
- Replacing Copilot CLI as the backend or building a separate agent runtime
- Removing the prerequisite that Copilot CLI must already be installed
- Advanced workflow parity with Codex Desktop beyond what is needed to validate the core Strategist-first interaction model

## Integration Pivot (Updated April 2026)

The original phase 1 approach drove Copilot via the `copilot --agent=strategist` CLI in interactive stdin/stdout mode. This approach proved fundamentally unreliable in a headless Electron context: the CLI requires a TTY, startup output races with response detection in piped mode, and the interactive prompt pattern cannot be reliably detected programmatically.

**The new approach replaces CLI-based chat integration with the GitHub Copilot SDK.**

### What Changes

- `src/infrastructure/copilot/adapter.ts` converts from a CLI process manager to a Copilot SDK implementation
- Session management may change depending on what session identifiers and history APIs the SDK exposes
- Authentication may shift from `copilot auth status` CLI probe to SDK-native auth, though the splash/install gate UX remains the same in principle

### What Stays the Same

All UI structure and user-facing behavior remains unchanged:
- Workspace picker and workspace persistence model
- Session list in the left rail
- Chat transcript and composer layout
- Sidebar, agent label display, and the authenticated shell
- The Strategist-first phase 1 focus

### Provider Abstraction Goal

The infrastructure layer must be designed around a `ChatProvider` interface so that:
- The Copilot SDK adapter is one implementation of that interface
- Future agents (Codex CLI, Claude Code, etc.) can be added by implementing the same interface without touching the UI or application layers
- Switching providers in a workspace or session is a configuration concern, not a structural change

The renderer must remain completely unaware of which underlying provider is active. All provider identity must stay behind the IPC boundary in the main process.

### Known Unknowns — Resolved

All questions resolved in `specs/copilot-sdk-migration/spec.md`. See Decisions 1–7 for full rationale and evidence.

- ✅ **Streaming**: `assistant.message_delta` EventEmitter events deliver token-level `deltaContent` chunks; `session.idle` signals completion. (Decision 1)
- ✅ **Session identity**: `session.sessionId` is a string that maps directly to `~/.copilot/session-state/<id>/`. No transformation needed. (Decision 2)
- ✅ **Prior session history**: `session.getMessages()` reconstructs transcripts via the SDK. JSONL parsing is eliminated. (Decision 3)
- ✅ **SDK auth vs CLI probe**: SDK uses the existing Copilot CLI credentials (`useLoggedInUser: true` default). The CLI probe remains for the install gate and login screen. Both coexist. (Decision 6)
- ✅ **Node.js / npm compatibility**: `@github/copilot-sdk` v0.2.2, requires Node.js >= 18.0.0. (Decision 7)
- ✅ **Workspace association**: SDK sessions do not carry workspace context. App manages sidecar files at `~/.copilot/session-state/<id>/.agentflow-meta.json` for workspace filtering. (Decision 4)

## Open Questions

- [x] What is the right login flow for GitHub Enterprise users once SDK auth replaces the CLI probe — does the SDK expose a GHE-compatible auth path? _(Resolved: GHE auth continues unchanged via the existing `copilot login --host` CLI probe. SDK migration does not affect GHE auth. See Decision 6.)_
- [x] Does the Copilot SDK support streaming, and at what granularity (tokens, lines, chunks)? _(Resolved: Yes — token-level `deltaContent` chunks via `assistant.message_delta` EventEmitter events. See Decision 1.)_
- [x] How are sessions identified in the SDK — does it expose a session ID compatible with the existing `~/.copilot/session-state/` format, or is a new session model required? _(Resolved: `session.sessionId` is a string compatible with the existing format. No new session model needed. See Decision 2.)_
- [x] Can session history be reconstructed from SDK calls alone, or does `events.jsonl` parsing still apply for prior-session display? _(Resolved: `session.getMessages()` provides the full transcript. JSONL parsing is removed. See Decision 3.)_
- [x] What Node.js or Electron version constraints does the SDK impose? _(Resolved: Node.js >= 18.0.0. Electron compat unverified but no known issues. See Decision 7.)_
- [x] What local metadata, if any, should the desktop app persist to make workspace and session discovery fast when SDK history retrieval is slow or unavailable? _(Resolved: App writes sidecar files at `~/.copilot/session-state/<id>/.agentflow-meta.json` containing `{ workspacePath, createdAt }`. See Decision 4.)_
- [x] Which parts of the design-token system must be established before implementation begins, and which can evolve during phase 1? _(Resolved: Not a blocker for the SDK migration — T01–T10 touch no UI code. Deferred to the next UI-facing epic.)_

## Success Criteria

- Product Owners can launch the application and complete a meaningful Strategist chat flow for refining product requirements or drafting user stories without relying on the terminal during the interaction.
- Users can clearly tell which agent they are using at all times, and can see that other specialist agents exist even if they are not yet available.
- Users can select a workspace folder, see its prior chat sessions, and start a new session within that folder from the desktop UI.
- Users can use chat interactions that feel familiar to Copilot-style tooling, including file-path-oriented context entry.
- Users who do not have Copilot CLI installed are clearly blocked by a helpful install flow, and users who do have it installed can authenticate through the splash/login experience using GitHub or GitHub Enterprise.
- The first release establishes an interaction model that can accommodate additional agents without rethinking the entire UI.
- The resulting product direction is clear enough for an Architect to derive a concrete specification, plan, and task breakdown for implementation.
