# Story: Show Previous Sessions For A Workspace

**As a** signed-in user, **I want** to see previous chat sessions for the selected workspace **so that** I can continue earlier work instead of starting over.

> Previous sessions are tied to the selected folder and should be surfaced through the left-side workspace context.

## Acceptance Criteria

- **Given** the user selects a workspace, **when** prior sessions exist for that folder, **then** the app lists those sessions in the workspace context.
- **Given** the user selects a workspace, **when** no prior sessions exist for that folder, **then** the app shows an appropriate empty state instead of an error.
- **Given** prior sessions are listed, **when** the user selects one, **then** the app opens that session in the chat area.
- **Given** the user opens a prior session, **when** session restoration is requested, **then** the app uses the Copilot CLI continuation mechanism rather than a separate app-owned conversation store.
- **Given** the user switches from one workspace to another, **when** the workspace changes, **then** the visible session list updates to match the newly selected folder.
