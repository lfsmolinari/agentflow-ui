# Story: Detect Missing Copilot CLI

**As a** Product Owner using the desktop app, **I want** the app to detect whether Copilot CLI is installed on startup **so that** I know immediately whether I can continue or need to install a prerequisite.

> The app depends entirely on Copilot CLI, so missing-install detection is a hard gate before any product functionality is available.

## Acceptance Criteria

- **Given** the user launches the app and Copilot CLI is not installed, **when** startup checks complete, **then** the app shows a dedicated install screen instead of the main product UI.
- **Given** the install screen is shown, **when** the user reads the guidance, **then** they see a link to Copilot installation instructions.
- **Given** the install screen is shown, **when** Copilot CLI is missing, **then** the app clearly tells the user to restart the app after installation.
- **Given** Copilot CLI is not installed, **when** the user is on the install screen, **then** chat, workspace, and agent features are not accessible.
