# Tasks: Milestone 1

## Status

- **Created**: 2026-04-13
- **Status**: Draft
- **Author**: Architect
- **Scope**: Install detection, login flow, and base desktop shell only

## Tasking Principles

- Keep Milestone 1 strictly limited to the first three stories:
  - install detection
  - login flow
  - authenticated empty shell
- Do not implement workspace selection, chat creation, session retrieval, agent switching, or file-context features in this milestone.
- Preserve the permanent Electron boundary model:
  - `main` owns privileged operations
  - `preload` exposes a narrow typed bridge
  - `renderer` owns presentation only
- Treat Copilot CLI as the source of truth for install and auth state.
- Confirm authentication only through a post-login auth refresh, never by process exit alone.

## Documentation Inputs

- `specs/agentflow-ui-phase-01/product-requirements.md`
- `specs/agentflow-ui-phase-01/ui-spec.md`
- `specs/agentflow-ui-phase-01/Milestone 1/plan.md`
- `specs/agentflow-ui-phase-01/Milestone 1/spec.md`
- `specs/agentflow-ui-phase-01/user-stories/README.md`
- `specs/agentflow-ui-phase-01/UX-Stories/README.md`

## External Reference Notes

These tasks assume the current official GitHub Docs guidance for Copilot CLI:

- install instructions should point to the official Copilot CLI install page:
  `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli`
- interactive authentication is supported through `copilot login`
- GitHub Enterprise Cloud authentication is supported through `copilot login --host HOSTNAME`

Implementation must still verify the exact command behavior in code during adapter development.

## Phase 1: App Foundation and Boundaries

### T1. Create the desktop app scaffold

- Bootstrap the Electron + React + TypeScript application structure.
- Create top-level source ownership for:
  - `src/main`
  - `src/preload`
  - `src/renderer`
  - `src/shared`
  - `src/infrastructure/copilot`
  - `src/infrastructure/system`
- Add baseline scripts for local development, build, lint, and test execution.

Dependencies:
- None. This is the milestone foundation.

Testing notes:
- Verify the app launches a renderer window successfully in development mode.
- Verify the initial project structure matches the architecture defined in `spec.md`.

### T2. Lock Electron security and bridge boundaries

- Configure Electron with:
  - context isolation enabled
  - Node integration disabled in the renderer
  - a preload-only bridge for privileged access
- Register a minimal typed IPC surface for Milestone 1 actions only.
- Prevent renderer code from importing Node or Electron main-process APIs directly.

Dependencies:
- Depends on `T1`.

Testing notes:
- Add a boundary-focused integration test or smoke validation that the renderer can only access approved preload methods.
- Manually verify no privileged APIs leak into the renderer global scope.

### T3. Define shared contracts and startup state types

- Create shared TypeScript types and schemas for:
  - `StartupState`
  - login request payloads
  - login action results
  - renderer-safe error payloads
  - install URL action contracts
- Encode the startup state model exactly as:
  - `checking`
  - `copilot_missing`
  - `unauthenticated`
  - `authenticating`
  - `authenticated`
  - `error`

Dependencies:
- Depends on `T1`.

Testing notes:
- Add unit coverage for shared state serialization or validation utilities if schemas are used.

## Phase 2: Styling and Token Foundation

### T4. Set up Tailwind CSS and tokenized global styles

- Install and configure Tailwind CSS for the renderer.
- Create the first CSS-variable-backed token set for:
  - colors
  - typography
  - spacing
  - radius
  - shadow
  - motion
- Wire tokens into the renderer global stylesheet so dark and light themes are both supported from the start.

Dependencies:
- Depends on `T1`.

Testing notes:
- Manually verify token variables resolve correctly in both dark and light modes.
- Add lightweight renderer tests for theme class or data-attribute switching if implemented.

### T5. Add the first headless interaction primitives

- Add Radix primitives only where Milestone 1 needs them:
  - dialog or modal
  - focus and dismiss behavior
- Style those primitives through local tokens rather than package defaults.

Dependencies:
- Depends on `T4`.

Testing notes:
- Verify focus trapping and keyboard dismissal for the enterprise host modal.

## Phase 3: System and Copilot Infrastructure

### T6. Implement system helpers for external links and process execution

- Create a system abstraction for:
  - opening external URLs
  - spawning monitored child processes
  - collecting stdout, stderr, and exit results where needed
- Keep the abstraction in the privileged layer only.

Dependencies:
- Depends on `T2`.

Testing notes:
- Add unit or integration coverage with process and shell helpers mocked.
- Verify external URL launching uses the single canonical install URL entry point.

### T7. Implement Copilot CLI discovery

- Create a Copilot adapter method to determine whether the `copilot` executable is available on the machine.
- Make the detection logic platform-aware without exposing platform specifics to the renderer.
- Return a renderer-safe result that can feed startup resolution.

Dependencies:
- Depends on `T3` and `T6`.

Testing notes:
- Add integration coverage for:
  - executable found
  - executable missing
  - unexpected process failure

### T8. Implement the auth-state probe

- Create a Copilot adapter method that determines whether Copilot CLI is installed but unauthenticated versus ready for authenticated use.
- Use this same probe for both startup state resolution and post-login confirmation.
- Ensure the probe returns normalized app states rather than raw CLI output.

Dependencies:
- Depends on `T7`.

Testing notes:
- Add integration coverage for:
  - unauthenticated result
  - authenticated result
  - probe failure mapping to `error`

### T9. Implement the startup-state resolver

- Create a single application-facing resolver that combines:
  - install detection
  - auth-state probe
- Expose a typed `getStartupState()` bridge method to the renderer.
- Ensure startup always resolves into one of the approved milestone states.

Dependencies:
- Depends on `T7` and `T8`.

Testing notes:
- Add unit coverage for state mapping logic.
- Add integration coverage that verifies:
  - missing Copilot leads to `copilot_missing`
  - installed but unauthenticated leads to `unauthenticated`
  - authenticated leads to `authenticated`
  - exceptions surface as `error`

## Phase 4: Install Gate and Login Actions

### T10. Implement canonical install URL handling

- Centralize the official Copilot CLI install URL in a configuration or constant module.
- Expose a privileged action to open that URL from the renderer.
- Ensure install-gate copy can instruct the user to restart the app after installation.

Dependencies:
- Depends on `T6`.

Testing notes:
- Add a small unit test for the configured URL constant if appropriate.
- Add integration coverage that the renderer action invokes the external-link helper, not direct browser APIs.

### T11. Implement standard GitHub login initiation

- Add a privileged application action for standard interactive login using documented Copilot CLI behavior.
- Route the action through the Copilot adapter, not directly from UI components.
- Normalize command start, command failure, and in-progress feedback into renderer-safe state updates.

Dependencies:
- Depends on `T8` and `T9`.

Testing notes:
- Add integration coverage for:
  - login command start
  - login command failure
  - login command completion followed by auth refresh request

### T12. Implement GitHub Enterprise login initiation with host normalization

- Create host validation and normalization rules for the enterprise host input.
- Add a privileged application action for `copilot login --host HOSTNAME`.
- Reject invalid host values before process execution.

Dependencies:
- Depends on `T11`.

Testing notes:
- Add unit coverage for host normalization and validation.
- Add integration coverage for:
  - valid host path
  - invalid host rejection
  - command wiring for enterprise login

### T13. Implement post-login auth refresh as the source of truth

- After any login attempt, trigger a fresh auth-state probe through the same startup/auth adapter.
- Transition the renderer to `authenticated` only if the refresh confirms authenticated state.
- Return the UI to `unauthenticated` or `error` with clear messaging if auth is not confirmed.

Dependencies:
- Depends on `T8`, `T11`, and `T12`.

Testing notes:
- Add integration coverage that explicitly verifies:
  - process exit alone does not mark auth success
  - auth refresh can promote the app to `authenticated`
  - auth refresh failure leaves the app out of the authenticated shell

## Phase 5: Renderer State Flow and Entry Screens

### T14. Build renderer startup-state orchestration

- Create the top-level renderer app state flow for:
  - `checking`
  - `copilot_missing`
  - `unauthenticated`
  - `authenticating`
  - `authenticated`
  - `error`
- Keep the renderer dependent on typed bridge calls only.
- Ensure there is one obvious screen per state, not overlapping UI layers.

Dependencies:
- Depends on `T3` and `T9`.

Testing notes:
- Add renderer tests for state-specific screen rendering.

### T15. Build the install gate UI

- Create the dedicated install gate screen matching the UI spec.
- Include:
  - product brand mark or logo area
  - concise explanation that Copilot CLI is required
  - a primary action to open the official install instructions
  - restart guidance
- Ensure no shell, sidebar, or chat UI is visible in this state.

Dependencies:
- Depends on `T10` and `T14`.

Testing notes:
- Add renderer tests asserting the install gate blocks the main shell.
- Manually verify install-link behavior opens the official docs page.

### T16. Build the login screen and enterprise host modal

- Create the unauthenticated screen with:
  - primary GitHub login action
  - secondary GitHub Enterprise action
  - short explanatory text
- Create the enterprise host modal or popup using the Radix-backed dialog pattern.
- Ensure the modal has keyboard-accessible confirm and cancel behavior.

Dependencies:
- Depends on `T5`, `T12`, and `T14`.

Testing notes:
- Add renderer tests for:
  - modal open and close behavior
  - host submission validation feedback
  - login screen action visibility

### T17. Build login progress and failure states

- Show an `authenticating` state after login starts.
- Provide low-noise progress feedback without exposing raw terminal output in the renderer.
- Display actionable error messaging when login or auth refresh fails.

Dependencies:
- Depends on `T11`, `T12`, `T13`, and `T16`.

Testing notes:
- Add renderer tests for:
  - authenticating state visibility
  - failure fallback behavior
  - retry path back to login actions

## Phase 6: Authenticated Base Shell

### T18. Build the authenticated shell frame

- Create the first authenticated desktop shell with:
  - persistent left rail
  - main content panel
  - minimal shell chrome
- Keep the layout structurally compatible with later workspace and chat milestones.

Dependencies:
- Depends on `T4` and `T14`.

Testing notes:
- Add renderer tests asserting the shell only renders for the authenticated state.

### T19. Build the empty-shell content state

- Implement the no-workspace-selected main-panel empty state.
- Make `Start a new project` the dominant action.
- Ensure the UI does not imply an active chat, session transcript, or agent context.
- Keep any left-rail content minimal and non-committal for this milestone.

Dependencies:
- Depends on `T18`.

Testing notes:
- Add renderer tests for the empty state call to action and the absence of chat/session UI.
- Manually verify the shell feels intentional in both light and dark modes.

## Phase 7: Verification and Milestone Hardening

### T20. Add integration coverage for Copilot and IPC boundaries

- Cover:
  - install detection
  - startup-state resolution
  - standard login wiring
  - enterprise login wiring
  - post-login auth refresh behavior
  - external install URL action

Dependencies:
- Depends on `T9`, `T10`, `T11`, `T12`, and `T13`.

Testing notes:
- Prefer integration tests around application and adapter boundaries with the Copilot layer mocked.

### T21. Add renderer coverage for milestone states and shell transitions

- Cover:
  - loading state
  - install gate
  - login state
  - enterprise modal
  - authenticating state
  - error state
  - authenticated empty shell

Dependencies:
- Depends on `T15`, `T16`, `T17`, `T18`, and `T19`.

Testing notes:
- Favor behavior-driven assertions over snapshots.

### T22. Perform manual milestone validation and capture follow-up notes

- Manually validate:
  - Copilot CLI missing path
  - Copilot CLI installed but unauthenticated path
  - GitHub login initiation
  - GitHub Enterprise host flow
  - auth-success transition via refresh
  - authenticated empty shell
  - dark and light theme rendering
- Record follow-up implementation notes for Milestone 2 without adding out-of-scope features now.

Dependencies:
- Depends on `T20` and `T21`.

Testing notes:
- Manual validation is required for real CLI and desktop shell behavior even if automated tests pass.

## Suggested Delivery Sequence

1. `T1` to `T5` establish the permanent app and styling foundation.
2. `T6` to `T9` make startup state resolution reliable.
3. `T10` to `T13` complete privileged install and auth actions.
4. `T14` to `T19` deliver the user-facing milestone screens and shell.
5. `T20` to `T22` harden and validate the milestone.

## Explicit Out-of-Scope Reminder

Do not pull these into Milestone 1 tasks:

- workspace picker or folder persistence
- `Start a new project` behavior beyond presenting the empty-shell CTA
- new chat creation
- previous session restoration
- agent selector in the composer
- file-path attachment
- artifact panels
- advanced Codex Desktop parity
