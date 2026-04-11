# Story: Show Agent Selection Inside The Chat Composer

**As a** signed-in user working in a workspace session, **I want** to see agent selection inside the chat composer **so that** choosing who I am talking to feels like part of composing a message.

> In phase 1, the agent selector should behave more like model selection in a chat tool than a global navigation control.

## Acceptance Criteria

- **Given** the user has an active workspace session, **when** the chat composer is visible, **then** the UI shows an agent selector inside or attached to the chat textarea area.
- **Given** the user is not inside an active workspace session, **when** they view the app shell, **then** the agent selector is not shown.
- **Given** the user is in phase 1, **when** they open the agent selector, **then** Strategist appears as the active available option.
- **Given** the user is in phase 1, **when** they view the agent selector, **then** other known agents may appear but are visually disabled and cannot be selected.
- **Given** disabled agents are shown, **when** the user inspects them, **then** the UI clearly communicates that those agents are not yet available.
