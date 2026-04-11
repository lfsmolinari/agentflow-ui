# Story: Include File Path Context In Chat

**As a** user working in a workspace session, **I want** to include file path references from my project in the chat composer **so that** I can give Strategist context tied to the selected workspace.

> This story covers the first phase of Copilot-style chat affordances and should remain limited to file-path-oriented context entry.

## Acceptance Criteria

- **Given** the user has an active workspace session, **when** they compose a message, **then** the chat experience supports adding file path references from the selected workspace.
- **Given** the user adds a file path reference, **when** it is attached to the message, **then** the reference is visible in the composer before sending.
- **Given** the user sends a message with one or more file path references, **when** the message is submitted, **then** those references are included as part of the session input context.
- **Given** the user is outside an active workspace session, **when** they try to use file path context features, **then** the app does not offer workspace file-path attachment behavior.
- **Given** the selected file path is not valid within the active workspace, **when** the user attempts to attach it, **then** the app prevents or rejects the attachment with clear feedback.
