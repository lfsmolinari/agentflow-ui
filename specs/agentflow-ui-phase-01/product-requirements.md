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

## Open Questions

- [ ] What is the right login flow for GitHub Enterprise users, including how and when the host URL is collected before running `copilot login --host`?
- [ ] How should the UI communicate with Copilot CLI and agent definitions at runtime while keeping the product feel responsive and desktop-native?
- [ ] What exact chat affordances from Copilot CLI and VS Code Copilot Chat are required in phase 1 beyond file-path inclusion?
- [ ] How should the UI identify and retrieve prior Copilot CLI sessions for a selected folder or workspace?
- [ ] What local metadata, if any, should the desktop app persist to make workspace and session discovery feel fast and reliable?
- [ ] Which parts of the Codex Desktop experience are essential to preserve in layout and interaction, and which should intentionally differ for Product Owner workflows?

## Success Criteria

- Product Owners can launch the application and complete a meaningful Strategist chat flow for refining product requirements or drafting user stories without relying on the terminal during the interaction.
- Users can clearly tell which agent they are using at all times, and can see that other specialist agents exist even if they are not yet available.
- Users can select a workspace folder, see its prior chat sessions, and start a new session within that folder from the desktop UI.
- Users can use chat interactions that feel familiar to Copilot-style tooling, including file-path-oriented context entry.
- Users who do not have Copilot CLI installed are clearly blocked by a helpful install flow, and users who do have it installed can authenticate through the splash/login experience using GitHub or GitHub Enterprise.
- The first release establishes an interaction model that can accommodate additional agents without rethinking the entire UI.
- The resulting product direction is clear enough for an Architect to derive a concrete specification, plan, and task breakdown for implementation.
