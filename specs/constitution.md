# Project Constitution

## Project Overview

- **Project name**: agentflow-ui
- **Description**: A desktop UI for Copilot CLI that provides a Codex-Desktop-like workspace for chatting with specialized agents, starting with Strategist.
- **Primary users**: Product Owners first, followed by Copilot CLI users who want a desktop chat experience for working with agents such as Strategist, Orchestrator, and Architect.
- **Current state**: The repository is at project start. It currently contains agent definitions and workflow scaffolding under `.codex/agents/`, with no production UI, application source, or shipped product functionality yet.

## Project Intent

This project exists to give Copilot CLI users a desktop experience similar in spirit to Codex Desktop, while staying centered on agent-based collaboration. Success means users can open a workspace folder, see its prior chat sessions, start a new chat in that workspace, and interact with specialist agents through a clear desktop interface instead of managing those flows manually in the CLI. Phase 1 focuses on making the Strategist experience genuinely useful for Product Owners while keeping the design extensible for additional agents.

## Technology Stack

- **Language**: TypeScript
- **Framework**: Electron + React
- **Styling**: Tailwind CSS with CSS variables for design tokens, plus Radix primitives for accessible headless UI components
- **Database**: N/A currently visible in the repository
- **Infrastructure**: Copilot CLI as the backend runtime, with a desktop shell around local CLI execution and a local Codex-style workspace scaffold with agent definitions in TOML under `.codex/agents/`
- **Testing**: [NEEDS CLARIFICATION: What automated testing layers and quality gates should be required for the Electron application?]

## Architecture Principles

1. **Agent-Oriented UX**: The product should treat distinct agents as first-class capabilities, with the interface designed around selecting, invoking, and expanding specialist roles over time.
2. **Strategist-First Foundation**: Phase 1 should deliver a useful Strategist workflow end to end before broadening support to additional agents.
3. **Extensible by Design**: The app should be structured so that new agents such as Orchestrator and Architect can be added without redesigning the core interaction model.
4. **Workspace-Centered Sessions**: A workspace maps to a folder or project, and the application should organize chat sessions around that folder context, including retrieval of prior sessions for the selected workspace.
5. **Copilot CLI as Source of Truth**: The desktop app should rely on Copilot CLI for authentication and session continuity where possible, instead of inventing a separate backend or duplicating core session behavior in phase 1.
6. **Token-Driven UI System**: Visual consistency should be enforced through a small design-token system implemented with CSS variables so that light and dark themes can evolve without rewriting component styles.

## Coding Standards

- **Style**: TypeScript-first across renderer, preload, and main process. Enforce ESLint and Prettier from the start. Prefer strict compiler settings, explicit types at module boundaries, and small focused modules over framework-heavy abstractions. Use Tailwind CSS for component styling, CSS variables for design tokens, and Radix primitives for accessible headless UI elements where needed.
- **Naming**: React components use `PascalCase`; hooks use `camelCase` with a `use` prefix; utility and service modules use project-standard file naming such as `kebab-case`; IPC channels and application commands should be named by intent, such as `listSessions`, `startSession`, and `checkCopilotInstalled`.
- **Error handling**: Renderer code must not call Copilot CLI or filesystem APIs directly. Risky operations must go through typed application or infrastructure boundaries. User-facing failures should surface as actionable UI states, while technical details are logged in the desktop layer. Errors should be explicit, recoverable where possible, and never silently swallowed.
- **Comments**: Prefer self-explanatory code and clear naming. Add comments only where intent, lifecycle, process orchestration, or security-sensitive behavior would otherwise be hard to infer. Public modules that bridge Electron, IPC, or Copilot CLI should document purpose and boundary assumptions.

## Design Standards

- **Theme support**: The UI should support both dark mode and light mode through the same token system, even if dark mode is the primary visual target during phase 1 refinement.
- **Token system**: Define a small shared token set for color, typography, spacing, radius, border treatment, shadow, and focus states using CSS variables.
- **Component philosophy**: Prefer custom product styling over heavy pre-themed component frameworks. Radix-style primitives may provide behavior and accessibility, but product identity should come from the token system and local styling.
- **Visual consistency**: Sidebar hierarchy, chat transcript, composer, buttons, overlays, and empty states should all derive from the same token decisions rather than ad hoc per-screen styling.

## Testing Standards

- **Required coverage**: No blanket percentage gate for phase 1. Instead, automated tests are required for session routing, workspace discovery, install and login state handling, and Copilot CLI adapter behavior that affects user flows.
- **Test types**: Unit tests for pure application logic and parsing or mapping functions; integration tests for IPC handlers, Copilot CLI adapter behavior, and workspace or session resolution; a small set of end-to-end desktop tests for critical user journeys.
- **Test approach**: Favor behavior testing at application and integration boundaries over snapshot-heavy UI testing. Mock Copilot CLI execution in most tests, use controlled fixtures for workspace and session discovery, and reserve end-to-end tests for only the most critical desktop-shell flows. For phase 1, session retrieval per folder and GitHub Enterprise login require integration coverage and manual validation, but not dedicated end-to-end coverage.

## Security Requirements

- **Authentication**: Authentication should be delegated to Copilot CLI, including support for `copilot login` and `copilot login --host` for GitHub Enterprise.
- **Authorization**: Phase 1 has no multi-user or role-based authorization model inside the app. The only UI-enforced capability boundary is agent availability state, such as visible-but-disabled agents. Any future workspace or capability restrictions must be introduced explicitly rather than assumed.
- **Data handling**: Treat workspace paths, session identifiers, and chat metadata as sensitive local data. Persist only the minimum metadata needed for workspace and session discovery and UX continuity, including a local session index or cache when it materially improves UX. Do not duplicate full Copilot conversation content unless the product direction changes explicitly to allow it. Secrets, tokens, and auth artifacts must remain under Copilot CLI management, not the app's.
- **Dependencies**: Use a minimal dependency set, prefer well-maintained packages, and avoid unnecessary Electron preload exposure. All renderer access to privileged APIs must go through an explicit preload bridge with narrow typed methods. Enable Electron security defaults appropriate for a local desktop app, including context isolation and no unchecked Node access in the renderer.

## Constraints

- The repository is currently empty of production application code, so initial direction must be established through specs before implementation.
- Phase 1 should prioritize support for the Strategist agent.
- The UI must be designed to support an agent selector and future expansion to additional agents, while non-phase-1 agents may be visible but unavailable.
- The intended experience should feel similar to Codex Desktop while serving Copilot CLI users.
- Copilot CLI is a prerequisite for using the application in phase 1.
- If Copilot CLI is not installed, the application should direct users to install instructions and ask them to restart the app after installation.

## Amendment Process

Agents assist human decision-making; they do not replace engineering judgment.

Changes to this constitution require:
1. Explicit documentation of the rationale
2. Review by the project owner
3. Backward compatibility assessment
