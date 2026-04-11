# Story: Start A New Strategist Chat In A Workspace

**As a** signed-in user, **I want** to start a new Strategist chat inside a selected workspace **so that** I can begin product-focused work in the context of that folder.

> In phase 1, new chat creation should always begin with the Strategist agent because it is the only enabled agent.

## Acceptance Criteria

- **Given** the user has selected a workspace, **when** they choose to start a new chat, **then** the app creates a new session tied to that workspace.
- **Given** the user starts a new chat in phase 1, **when** the session opens, **then** the active agent is Strategist.
- **Given** a new Strategist chat has started, **when** the chat area appears, **then** the user can begin interacting without needing to configure the agent manually.
- **Given** the user has not selected a workspace, **when** they attempt to start a new chat, **then** the app requires workspace selection first.
