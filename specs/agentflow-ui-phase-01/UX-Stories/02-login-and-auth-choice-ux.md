# UX Story: Login And Authentication Choice

**As a** user with Copilot CLI installed, **I want** a simple login screen that lets me choose GitHub or GitHub Enterprise **so that** I can enter the app through a flow that matches my account type.

> This story defines the splash or auth entry state after the install prerequisite has been satisfied.

## UX Intent

- Keep authentication simple and obvious
- Make the default GitHub path feel effortless
- Keep the GitHub Enterprise path available without overwhelming the default path

## Experience Expectations

- The screen should feel like a continuation of the install gate rather than a separate app mode
- A primary GitHub login action should dominate the hierarchy
- GitHub Enterprise should be discoverable as a secondary action or link
- Enterprise login should open a focused prompt for the host URL instead of overloading the main screen
- The user should feel guided into the main app after success, not dropped into a raw system workflow

## Acceptance Criteria

- **Given** Copilot CLI is installed but the user is not authenticated, **when** the app opens, **then** a dedicated login screen is shown before the workspace shell.
- **Given** the login screen is shown, **when** the user views the actions, **then** GitHub login reads as the primary path.
- **Given** the login screen is shown, **when** the user needs GitHub Enterprise, **then** that option is visible but visually secondary.
- **Given** the user chooses GitHub Enterprise, **when** the next step begins, **then** the host is requested in a focused popup or modal rather than in the main shell.
- **Given** authentication succeeds, **when** the state updates, **then** the user transitions into the product shell instead of remaining on the auth screen.
