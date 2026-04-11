# UX Story: Active Chat And Composer Layout

**As a** user working with Strategist, **I want** the active chat view to emphasize the conversation and composer **so that** the app feels like a focused thinking workspace instead of a cluttered tool panel.

> This story describes the main interaction surface once a session is active.

## UX Intent

- Keep the chat transcript as the dominant content area
- Preserve a calm, minimal visual rhythm
- Make the composer feel powerful but visually lightweight

## Experience Expectations

- The conversation should occupy the center of the interface with generous spacing
- The composer should anchor the bottom of the view
- The composer should feel like the main control surface for the session
- The UI should visually distinguish user and agent messages without adding unnecessary chrome
- Header and utility controls should stay present but quiet

## Acceptance Criteria

- **Given** a session is active, **when** the chat view is rendered, **then** the conversation area is the visual focal point of the layout.
- **Given** a session is active, **when** the composer is shown, **then** it is anchored in a stable bottom position consistent with modern chat tools.
- **Given** the user reads the conversation, **when** messages from the user and Strategist appear, **then** their distinction is clear without relying on heavy framing.
- **Given** the user is in an active session, **when** they scan the screen, **then** utility actions do not compete with the transcript or composer for attention.
