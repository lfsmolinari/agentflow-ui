# UX Story: File Context In Composer

**As a** user working inside a workspace session, **I want** file-path context to be attachable from the composer **so that** I can reference project artifacts while staying in a minimal chat flow.

> This story covers the UX of file-path-oriented context entry rather than the technical mechanics behind it.

## UX Intent

- Make file context feel native to the chat flow
- Avoid turning the composer into a complex attachment surface
- Keep the feature discoverable but lightweight

## Experience Expectations

- File references should be added from the composer area, not from a separate advanced screen
- Attached file-path context should be visible before send
- The interaction should feel consistent with modern Copilot-style workflows
- Invalid selections should be blocked with clear and quiet feedback

## Acceptance Criteria

- **Given** the user is in an active workspace session, **when** they use file context features, **then** the interaction originates from the composer area.
- **Given** one or more file paths are attached, **when** the user reviews the composer before sending, **then** the attachments are visible and understandable.
- **Given** the user attempts to attach a file path outside the active workspace or in an invalid format, **when** the action is processed, **then** the app provides clear feedback without breaking the composing flow.
- **Given** the user is not in an active workspace session, **when** they view the shell, **then** file context affordances are not shown as available.
