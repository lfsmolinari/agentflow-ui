# UX Story: Install Gate Entry Experience

**As a** first-time user opening the desktop app, **I want** the app to immediately tell me whether I can proceed or must install Copilot CLI **so that** I am not confused by an interface that cannot function yet.

> This story defines the visual and interaction behavior of the hard-stop entry state when the required backend is missing.

## UX Intent

- Make the dependency on Copilot CLI obvious
- Avoid showing unusable product UI before prerequisites are met
- Keep the screen calm, branded, and instructional rather than error-heavy

## Experience Expectations

- The user lands on a single dedicated install gate screen
- The screen clearly explains that Copilot CLI is required for the application to work
- The primary action takes the user to Copilot install instructions
- Supporting text tells the user to restart the application after installation
- No workspace, chat, or agent UI is shown behind or around this screen

## Acceptance Criteria

- **Given** Copilot CLI is not installed, **when** the app launches, **then** the install gate appears as the only visible screen.
- **Given** the install gate is visible, **when** the user scans the page, **then** they can understand in a few seconds why the app cannot continue.
- **Given** the install gate is visible, **when** the user wants to proceed, **then** a clear install action is available without requiring hidden navigation.
- **Given** the install gate is visible, **when** the user has completed installation, **then** the app tells them to restart rather than implying live recovery in phase 1.
