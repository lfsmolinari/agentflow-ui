# Story: Authenticate With GitHub or GitHub Enterprise

**As a** Product Owner with Copilot CLI installed, **I want** to authenticate from the desktop app using GitHub or GitHub Enterprise **so that** I can enter the workspace experience without dropping into the terminal manually.

> This story covers the splash/login experience after the install prerequisite has been satisfied.

## Acceptance Criteria

- **Given** Copilot CLI is installed and the user is not authenticated, **when** the splash screen is shown, **then** the app presents a primary GitHub login action.
- **Given** Copilot CLI is installed and the user is not authenticated, **when** the splash screen is shown, **then** the app presents a GitHub Enterprise entry option separate from the standard GitHub login action.
- **Given** the user selects GitHub Enterprise login, **when** the enterprise flow begins, **then** the app prompts the user to enter the enterprise host in a dedicated popup or modal.
- **Given** the user provides a GitHub Enterprise host, **when** they confirm the login action, **then** the app starts the enterprise login flow using that host.
- **Given** authentication completes successfully, **when** the app refreshes auth state, **then** the user is allowed to enter the main workspace experience.
