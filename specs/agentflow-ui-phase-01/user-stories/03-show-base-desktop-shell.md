# Story: Show The Base Desktop Shell

**As a** signed-in user, **I want** to see a clear desktop layout with a left workspace panel and a central chat area **so that** I can understand the product structure and begin working in a project.

> This establishes the Codex-Desktop-inspired shell before workspace/session details are added.

## Acceptance Criteria

- **Given** the user is authenticated, **when** they enter the app, **then** they see a desktop layout with a left-side panel and a central chat area.
- **Given** the user has not opened any workspace yet, **when** the shell loads, **then** the chat area shows an empty state with a prominent action to start a new project.
- **Given** the left-side panel is visible, **when** the user views it, **then** it is clearly presented as the place for workspace or project context.
- **Given** the user is in the base shell, **when** no workspace is selected yet, **then** the UI does not imply that chat is active for a project that has not been opened.
