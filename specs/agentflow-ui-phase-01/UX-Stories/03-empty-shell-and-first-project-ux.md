# UX Story: Empty Shell And First Project State

**As a** newly authenticated user, **I want** the shell to clearly guide me toward opening my first project **so that** the empty app feels intentional and inviting rather than blank.

> This story covers the first in-product state before any workspace has been added.

## UX Intent

- Introduce the desktop shell without cognitive overload
- Make the next best action immediately visible
- Reinforce that the app is organized around workspaces and sessions

## Experience Expectations

- The shell opens with a persistent left rail and a large central content area
- The left rail suggests workspace and session context, even before data exists
- The main panel presents a strong first-action affordance such as `Start a new project`
- The empty state should feel minimal and product-defining, not like missing content
- The layout should echo Codex Desktop minimalism: spacious, restrained, and centered on the next action

## Acceptance Criteria

- **Given** the user has authenticated successfully and no workspace is selected, **when** the main shell loads, **then** the app shows a purposeful empty state instead of an empty chat transcript.
- **Given** the empty shell is shown, **when** the user looks at the main panel, **then** the primary call to action is to start a new project.
- **Given** the empty shell is shown, **when** the user looks at the left rail, **then** they can infer that workspaces and sessions will live there once added.
- **Given** the empty shell is shown, **when** the user compares the layout to the intended reference, **then** the UI feels minimal and desktop-native rather than crowded or dashboard-like.
