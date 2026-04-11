# UX Story: Disabled Agent Visibility And Future Expansion

**As a** user in an active session, **I want** to see that other agents exist even if they are not usable yet **so that** I understand the product is extensible without being confused about what is available now.

> This story focuses on how phase 1 should signal future capability without creating false affordances.

## UX Intent

- Communicate the multi-agent product direction
- Avoid making unavailable agents feel broken
- Keep Strategist clearly primary in phase 1

## Experience Expectations

- Other agents may appear in the selector, but they must read as intentionally unavailable
- Strategist should remain the obvious active option
- Disabled entries should teach, not frustrate
- The UX should hint at future expansion without inviting unsupported interaction paths

## Acceptance Criteria

- **Given** the user opens the agent selector in an active session, **when** the menu appears, **then** Strategist is clearly available and selected by default in phase 1.
- **Given** the selector includes future agents, **when** the user views them, **then** they are visually disabled and cannot be chosen.
- **Given** a disabled agent is visible, **when** the user inspects the state, **then** the UI makes it clear that the limitation is intentional and temporary rather than an error.
- **Given** the user is not in an active session, **when** they view the shell, **then** the agent selector is not shown as a global app control.
