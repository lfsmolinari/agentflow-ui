# Story: Add A Workspace By Folder

**As a** signed-in user, **I want** to add a local folder as a workspace **so that** I can organize my chats around a specific project.

> A workspace is the app’s representation of a project folder and should persist in the left panel for future reuse.

## Acceptance Criteria

- **Given** the user is in the desktop shell, **when** they click `Start a new project`, **then** the app prompts them to choose a local folder.
- **Given** the user selects a valid folder, **when** the selection is confirmed, **then** that folder is added as a workspace in the left panel.
- **Given** the user has already added one or more workspaces, **when** they view the workspace area, **then** they see a `+` action for adding another workspace.
- **Given** the user clicks the `+` action, **when** they choose a local folder, **then** the new folder is added to the workspace list without removing existing workspaces.
- **Given** a workspace has been added, **when** the user returns to the app later, **then** that workspace remains available in the left panel unless explicitly removed in a future capability.
