# Spec: Milestone 1

## Status

- **Created**: 2026-04-13
- **Status**: Draft
- **Author**: Architect
- **Scope**: Install detection, login flow, and base desktop shell only

## Summary

Milestone 1 defines the first executable desktop slice of AgentFlow UI. The application must:

- detect whether GitHub Copilot CLI is installed
- block the user behind a dedicated install gate when it is missing
- support login initiation for GitHub and GitHub Enterprise Cloud through Copilot CLI
- transition authenticated users into a minimal desktop shell with a left rail and a `Start a new project` empty state

This milestone establishes the permanent desktop architecture and the initial token-driven UI foundation, but it does not yet include workspace selection, session restoration, agent switching, or file-context features.

## Users

- Product Owners using Strategist-first workflows
- Copilot CLI users who want a desktop-native shell rather than a terminal-first experience

## Problem Statement

Before AgentFlow UI can provide any workspace or chat functionality, it must solve three foundational user needs:

1. clearly explain when the required Copilot CLI dependency is missing
2. offer a desktop-native login entry point for GitHub and GitHub Enterprise Cloud
3. provide a calm authenticated shell that introduces the workspace-based model before chat behavior begins

If these three states are not handled well, the product feels broken or incomplete before users ever reach the core workflow.

## Goals

- Establish a deterministic app startup flow based on Copilot CLI availability and authentication state
- Hide privileged runtime details behind clean Electron boundaries
- Deliver a product-quality install gate and login experience rather than exposing terminal behavior directly
- Introduce the first authenticated shell state with consistent dark/light theme tokens
- Preserve alignment with the UI spec and phase 1 minimalist desktop direction

## Non-Goals

- Selecting a workspace folder
- Starting a new chat session
- Retrieving previous sessions
- Showing the agent selector in the composer
- Supporting file-path context attachment
- Implementing a right-side artifact panel
- Achieving full Codex Desktop feature parity

## Inputs

This spec is derived from:

- `specs/constitution.md`
- `specs/agentflow-ui-phase-01/product-requirements.md`
- `specs/agentflow-ui-phase-01/Milestone 1/plan.md`
- `specs/agentflow-ui-phase-01/ui-spec.md`
- `specs/agentflow-ui-phase-01/user-stories/01-detect-missing-copilot-cli.md`
- `specs/agentflow-ui-phase-01/user-stories/02-authenticate-with-github-or-ghe.md`
- `specs/agentflow-ui-phase-01/user-stories/03-show-base-desktop-shell.md`
- `specs/agentflow-ui-phase-01/UX-Stories/01-install-gate-entry-ux.md`
- `specs/agentflow-ui-phase-01/UX-Stories/02-login-and-auth-choice-ux.md`
- `specs/agentflow-ui-phase-01/UX-Stories/03-empty-shell-and-first-project-ux.md`

## External Documentation Constraints

This milestone relies on the current official GitHub Copilot CLI documentation.

Observed facts from GitHub Docs:

- official install documentation exists at:
  `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli`
- Copilot CLI install methods include npm, Homebrew, WinGet, install script, and direct download
- for interactive auth, the docs explicitly support `/login` inside Copilot CLI and `copilot login` from the terminal
- for GitHub Enterprise Cloud with data residency, the docs explicitly support `copilot login --host HOSTNAME`
- the OAuth device flow shows a one-time code, opens the browser, and reports success in terminal
- credential lookup may involve environment variables, stored OAuth state, or GitHub CLI fallback behavior

For Milestone 1, the install gate should treat the official install docs page above as the canonical install URL. In this context, “canonical install URL” means the single official install-instructions link the application opens from the install gate.

## Functional Requirements

### FR1: Startup State Resolution

On launch, the app must resolve into one of these startup states:

- `checking`
- `copilot_missing`
- `unauthenticated`
- `authenticating`
- `authenticated`
- `error`

The renderer must not perform privileged checks directly. Startup state resolution must come from a typed application-facing API exposed through the Electron boundary.

### FR2: Copilot CLI Install Detection

The app must determine whether the `copilot` executable is available on the host system.

If Copilot CLI is unavailable:

- the user must see a dedicated install gate
- no shell, chat, workspace, or agent UI may be shown
- the install gate must provide a clear action to open the canonical install URL
- the gate must instruct the user to restart the app after installation

### FR3: Unauthenticated Login Screen

If Copilot CLI is installed but the user is not authenticated:

- the app must show a dedicated login screen before the desktop shell
- the primary action must initiate standard GitHub login
- the secondary action must open a GitHub Enterprise Cloud host-entry flow
- the login screen must clearly communicate that authentication is handled through Copilot CLI

### FR4: GitHub Login Initiation

The app must support starting a GitHub login flow via Copilot CLI.

The renderer may request login, but:

- the command must be executed from the privileged desktop layer
- the renderer must receive state updates, not raw terminal ownership
- the app must display progress and failure states if login does not complete immediately

### FR5: GitHub Enterprise Login Initiation

The app must support starting a GitHub Enterprise Cloud login flow using a host entered by the user.

Requirements:

- host entry must happen in a focused modal or popup
- the host must be validated and normalized before command execution
- the login flow must use the documented `copilot login --host HOSTNAME` contract

### FR6: Auth Success Detection

The app must detect successful authentication and transition to the authenticated shell without requiring an app restart.

Architecture decision:

- auth success must not be inferred solely from process exit status
- after any login attempt, the main process must trigger a follow-up auth-state refresh using the same adapter used for startup resolution
- the renderer should transition to `authenticated` only after the refresh confirms the authenticated state
- if login exits without confirmed auth, the app must remain in or return to an unauthenticated or error state with clear user feedback

Rationale:

- documented login uses browser-based OAuth device flow and terminal feedback
- process completion alone does not guarantee a durable authenticated state
- a post-login auth refresh keeps startup and login transitions aligned around one source of truth

### FR7: Authenticated Empty Shell

If the user is authenticated:

- the app must render the base desktop shell
- the left rail must be visible
- the main panel must show an intentional empty state
- the dominant action must be `Start a new project`
- the shell must not yet imply that a workspace, session, or chat transcript is active

### FR8: Theme Foundation

Milestone 1 must establish the initial token-driven design system needed for later milestones.

Requirements:

- styling must use Tailwind CSS backed by CSS variables for tokens
- the token foundation must support both dark and light mode
- install gate, login screen, buttons, shell surfaces, empty state, and core typography must all derive from the token system
- Radix primitives may be used for interactive elements such as dialogs, but visuals must come from local tokenized styling

## UX Requirements

### UXR1: Install Gate

- must feel like a dedicated product state, not a browser error or modal interruption
- must explain the dependency quickly
- must provide one strong install action
- must not reveal non-functional product UI in the background

### UXR2: Login Screen

- must preserve the same structural rhythm as the install gate
- GitHub login must read as the default path
- GitHub Enterprise must be visible but secondary
- host entry must be focused and low-noise

### UXR3: Empty Shell

- must feel intentional rather than incomplete
- must introduce the persistent left rail without pretending workspace data exists
- must center the user on the next meaningful action: opening the first project

## Architectural Requirements

### AR1: Electron Boundaries

The implementation must preserve these boundaries:

- `main` owns privileged process execution, URL launching, and IPC coordination
- `preload` exposes a narrow typed bridge to the renderer
- `renderer` owns presentation and local UI state only

The renderer must not directly access Node, filesystem, or process APIs.

### AR2: Shared Contracts

The app must define shared types for:

- startup state
- login requests
- login results or state transitions
- error payloads appropriate for renderer display

### AR3: Copilot CLI Adapter

Copilot-related operations must be isolated behind a dedicated adapter or infrastructure module, including:

- install detection
- auth-state probe
- login initiation
- post-login refresh

This adapter should be the only layer that knows how Copilot CLI is queried or invoked.

### AR4: UI Shell Stability

The base shell introduced in Milestone 1 must be structurally compatible with later milestones so it does not need to be replaced when workspaces and sessions are added.

## Acceptance Criteria

### Story Alignment: Detect Missing Copilot CLI

- **Given** the user launches the app and Copilot CLI is not installed, **when** startup checks complete, **then** the app shows a dedicated install screen instead of the main product UI.
- **Given** the install screen is shown, **when** the user reads the guidance, **then** they see a link to Copilot installation instructions.
- **Given** the install screen is shown, **when** Copilot CLI is missing, **then** the app clearly tells the user to restart the app after installation.
- **Given** Copilot CLI is not installed, **when** the user is on the install screen, **then** chat, workspace, and agent features are not accessible.

### Story Alignment: Authenticate With GitHub or GitHub Enterprise

- **Given** Copilot CLI is installed and the user is not authenticated, **when** the splash screen is shown, **then** the app presents a primary GitHub login action.
- **Given** Copilot CLI is installed and the user is not authenticated, **when** the splash screen is shown, **then** the app presents a GitHub Enterprise entry option separate from the standard GitHub login action.
- **Given** the user selects GitHub Enterprise login, **when** the enterprise flow begins, **then** the app prompts the user to enter the enterprise host in a dedicated popup or modal.
- **Given** the user provides a GitHub Enterprise host, **when** they confirm the login action, **then** the app starts the enterprise login flow using that host.
- **Given** authentication completes successfully, **when** the app refreshes auth state, **then** the user is allowed to enter the main workspace experience.

### Story Alignment: Show The Base Desktop Shell

- **Given** the user is authenticated, **when** they enter the app, **then** they see a desktop layout with a left-side panel and a central chat area.
- **Given** the user has not opened any workspace yet, **when** the shell loads, **then** the chat area shows an empty state with a prominent action to start a new project.
- **Given** the left-side panel is visible, **when** the user views it, **then** it is clearly presented as the place for workspace or project context.
- **Given** the user is in the base shell, **when** no workspace is selected yet, **then** the UI does not imply that chat is active for a project that has not been opened.

## Assumptions

- the canonical install URL will be the official GitHub Docs install page for Copilot CLI
- standard login can be initiated through documented Copilot CLI login behavior
- enterprise login can be initiated through the documented `copilot login --host HOSTNAME` flow
- auth state can be re-queried after login through a dedicated adapter without forcing a full app restart
- platform-specific command behavior may vary slightly, but the app-level state machine remains stable

## Open Implementation Notes

- the exact adapter logic for detecting authenticated state remains an implementation detail, but it must support both startup probing and post-login refresh
- the exact UX treatment for login-progress feedback can be refined during implementation as long as it preserves the state model
- the canonical install URL may be centralized in configuration for easier future updates

## Validation Strategy

- unit-test startup-state mapping logic and host normalization logic
- integration-test Copilot CLI detection, auth probing, and login-related IPC boundaries with mocks
- manually validate missing CLI, unauthenticated login, enterprise login, and authenticated-shell transitions
- verify both dark and light token-driven themes for install gate, login, and empty shell
