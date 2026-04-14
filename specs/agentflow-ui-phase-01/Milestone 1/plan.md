# Implementation Plan: Milestone 1

## Status

- **Created**: 2026-04-13
- **Status**: Draft
- **Author**: Architect
- **Scope**: Install detection, login flow, and base desktop shell only

## Milestone Goal

Deliver the first executable desktop slice of AgentFlow UI so users can launch the app, be correctly gated by Copilot CLI availability, authenticate through GitHub or GitHub Enterprise via Copilot CLI, and arrive in a minimal but intentional desktop shell with a left rail and a `Start a new project` empty state.

## In Scope

- Electron application bootstrap with clear `main`, `preload`, and `renderer` boundaries
- React renderer scaffold with Tailwind CSS, CSS-variable design tokens, and Radix primitives where needed
- Startup state resolution for:
  - Copilot CLI missing
  - Copilot CLI installed but unauthenticated
  - Copilot CLI installed and authenticated
- Install gate screen with external install-instructions action
- Login screen with:
  - GitHub login action
  - GitHub Enterprise secondary action
  - enterprise-host modal or popup
- Auth refresh flow after login completes
- Authenticated empty shell with left rail, central empty state, and `Start a new project` primary action
- Initial light and dark theme token setup for the entry flow and base shell

## Out of Scope

- Workspace folder selection
- New chat creation
- Previous session retrieval
- Agent selector behavior during active sessions
- File-context attachment behavior
- Right-side artifact panels or advanced Codex Desktop parity
- Full conversation transport with Copilot CLI

## Architectural Direction

Milestone 1 should establish the permanent desktop architecture, not a disposable prototype. The constitution already sets the key boundaries:

- `renderer` owns presentation, view state, and user interaction only
- `preload` exposes a narrow typed API to the renderer
- `main` coordinates application lifecycle, privileged operations, and IPC wiring
- infrastructure modules encapsulate Copilot CLI process execution, install detection, auth detection, and external-link launching

To keep later milestones simple, the renderer should depend on an application-facing API such as:

- `getStartupState()`
- `openCopilotInstallInstructions()`
- `loginWithGitHub()`
- `loginWithGitHubEnterprise(host)`
- `refreshAuthState()`

This milestone should also introduce a single startup state model so screen transitions are deterministic:

- `checking`
- `copilot_missing`
- `unauthenticated`
- `authenticating`
- `authenticated`
- `error`

## Suggested Project Structure

The repository currently contains specs only, so Milestone 1 should create the first application structure with clean ownership from the start.

Suggested shape:

- `src/main/`
  - Electron bootstrap
  - IPC registration
  - shell-safe OS integrations
- `src/preload/`
  - typed bridge for renderer-safe methods
- `src/renderer/`
  - app shell
  - entry screens
  - theme setup
  - shared UI primitives
- `src/shared/`
  - cross-boundary types
  - startup-state definitions
  - command payload schemas
- `src/infrastructure/copilot/`
  - Copilot CLI discovery
  - auth-state checks
  - login command execution
- `src/infrastructure/system/`
  - external URL opening
  - process helpers
  - platform-aware executable lookup

The exact folder names may vary, but this separation should remain intact.

## Phase Plan

### Phase 1: Foundation and Boundaries

Objective:
Stand up the desktop application skeleton and shared contracts so the rest of the milestone can be built without leaking Electron or process concerns into the renderer.

Implementation steps:

1. Scaffold the Electron + React + TypeScript application.
2. Add Tailwind CSS and create the first token-backed global theme layer using CSS variables.
3. Add a minimal headless primitive setup for dialog or modal behavior.
4. Define shared TypeScript types for startup state, auth actions, and renderer-facing responses.
5. Implement the preload bridge and typed IPC contracts for Milestone 1 actions only.
6. Set Electron security defaults:
   - context isolation enabled
   - Node disabled in renderer
   - narrow preload API only

Dependencies:

- Electron app bootstrap must exist before UI or CLI integration work can be wired.
- Shared types should be in place before IPC and renderer state management are implemented.

Exit criteria:

- The app launches into a renderer shell.
- Renderer-to-main communication is typed and minimal.
- Theme tokens are available in both dark and light mode.

### Phase 2: Copilot CLI Detection and Startup State Resolution

Objective:
Create the startup gate that determines whether the user sees install guidance, login, or the authenticated shell.

Implementation steps:

1. Implement a Copilot CLI locator that checks whether the `copilot` executable is available on the host machine.
2. Implement an auth-state probe that determines whether Copilot CLI is installed but unauthenticated versus ready for use.
3. Wrap both checks in a startup-state resolver owned by the application or infrastructure layer.
4. Expose one renderer-facing `getStartupState()` action so the UI does not need to coordinate low-level checks itself.
5. Implement the install-instructions launcher as a privileged action from `main`.
6. Add renderer state handling for:
   - initial loading
   - missing Copilot CLI
   - unauthenticated
   - authenticated
   - unexpected failure

Dependencies:

- Requires the shared startup-state model from Phase 1.
- Depends on confirming the canonical install-instructions URL.

Exit criteria:

- App startup consistently resolves into one of the defined entry states.
- Missing Copilot CLI produces a hard gate with no shell or chat UI shown.

### Phase 3: Login Flow and Auth Refresh

Objective:
Provide a product-quality login experience that delegates authentication to Copilot CLI without exposing raw terminal behavior in the renderer.

Implementation steps:

1. Implement `loginWithGitHub()` using the appropriate Copilot CLI command invocation.
2. Implement `loginWithGitHubEnterprise(host)` with validation and normalization of the host value before invoking `copilot login --host`.
3. Create the login screen with:
   - primary GitHub action
   - secondary GitHub Enterprise action
   - focused enterprise-host modal
4. Add login-progress and failure states so the UI does not feel frozen while the CLI flow runs.
5. Implement a post-login auth refresh path so successful authentication transitions the user into the shell.
6. Ensure the main process owns process spawning, logging, and error capture.

Dependencies:

- Depends on the startup-state resolver from Phase 2.
- Depends on confirming the exact Copilot CLI commands and expected exit behavior across platforms.

Exit criteria:

- Standard GitHub login can be initiated from the app.
- GitHub Enterprise login can be initiated after host entry.
- Successful auth leads to the authenticated shell without restarting the app.

### Phase 4: Base Desktop Shell

Objective:
Deliver the first authenticated in-product state: a calm desktop shell with a left rail and an intentional empty main panel.

Implementation steps:

1. Build the top-level authenticated shell frame with:
   - left rail
   - main content panel
   - minimal shell chrome
2. Implement the no-workspace-selected empty state with a strong `Start a new project` primary action.
3. Make the left rail visible after auth, but keep it structurally minimal for Milestone 1.
4. Ensure the shell does not imply that chat is already active.
5. Apply the first token-driven component styling for:
   - entry screens
   - buttons
   - shell panels
   - typography
   - empty state
6. Verify both dark and light themes maintain the same hierarchy and restraint.

Dependencies:

- Requires authenticated-state transition from Phase 3.
- Depends on token setup from Phase 1.

Exit criteria:

- Authenticated users land in the shell, not on a blank page.
- The left rail and empty main state align with the UI spec for UX stories 01 to 03.

### Phase 5: Hardening, Verification, and Milestone Closeout

Objective:
Stabilize Milestone 1 behavior before handing off to the next implementation slice.

Implementation steps:

1. Add integration coverage for startup-state resolution, install detection, and login command wiring.
2. Add renderer-level tests for key screen transitions and shell-state rendering.
3. Perform manual validation for:
   - Copilot CLI missing
   - Copilot CLI installed but unauthenticated
   - GitHub login
   - GitHub Enterprise login
   - authenticated shell
   - dark and light theme rendering
4. Review logs and error handling to ensure user-facing failures remain actionable and technical details stay out of the renderer.
5. Capture known gaps to hand forward into Milestone 2.

Dependencies:

- All prior phases must be functionally complete enough to exercise state transitions.

Exit criteria:

- Milestone 1 acceptance stories can be demonstrated manually.
- Automated test coverage exists for the highest-risk application and integration boundaries.

## Application Menu Convention

The default Electron menu (File | Edit | View | Window | Help) must be suppressed in all environments. Call `Menu.setApplicationMenu(null)` before the `BrowserWindow` is created. AgentFlow UI is a single-purpose shell — the default items are browser scaffolding that have no product meaning here and contradict the custom-chrome intent already expressed by `titleBarStyle: hiddenInset` on macOS. DevTools access in development should be provided through a conditional `webContents.openDevTools()` call or keyboard shortcut, not through the production menu. A minimal macOS-specific app menu (Quit, About) can be added in a future milestone if needed.

## Dependency Notes

Key decisions or confirmations needed before or during implementation:

- the exact Copilot CLI commands for install detection, auth-state detection, and login initiation
- the canonical install-instructions URL to open from the install gate
- how auth success is detected after login completes
- whether login command execution requires a visible terminal, embedded terminal handling, or background process monitoring on each supported platform

These are implementation dependencies, not product blockers, but they need to be resolved early in the milestone.

## Risks

### Risk 1: Copilot CLI Auth-State Detection Is Less Straightforward Than Expected

Why it matters:
If auth status cannot be checked cheaply and reliably, the entry flow may become brittle or confusing.

Mitigation:

- isolate auth probing behind a dedicated adapter
- design the startup state machine to support an explicit error state
- validate the CLI contract early before building too much UI around assumptions

### Risk 2: Login Flow Feels Like a Raw Terminal Escape Hatch

Why it matters:
The product promise is a desktop-first experience. If login feels bolted on, the milestone will satisfy functionality but miss usability.

Mitigation:

- keep process orchestration in `main`
- provide progress and failure states in the renderer
- use modal-based enterprise host entry instead of exposing raw command parameters

### Risk 3: Renderer Becomes Coupled to Privileged Logic Too Early

Why it matters:
This would violate the constitution and make future milestones harder to test and evolve.

Mitigation:

- keep renderer access limited to typed preload methods
- place all process, filesystem, and URL-launching behavior behind main-process services
- avoid direct Electron API usage in React components

### Risk 4: The Base Shell Overcommits To Future Workspace Behavior

Why it matters:
Milestone 1 should establish structure without dragging in Milestone 2 scope.

Mitigation:

- keep the left rail intentionally minimal
- show shell structure and empty-state cues only
- do not add fake session data or inactive chat controls

### Risk 5: Theme Tokens Are Added Too Late

Why it matters:
Retrofitting dark and light mode later would create avoidable churn.

Mitigation:

- define token groups during Phase 1
- build entry screens and shell surfaces from tokens immediately
- treat theme support as part of the milestone, not follow-up polish

## Test Approach

Milestone 1 should follow the constitution's guidance: emphasize application and integration boundaries, keep end-to-end scope very small, and rely on manual validation where desktop auth behavior is environment-sensitive.

### Unit Tests

Focus:

- startup-state mapping logic
- enterprise-host validation and normalization
- theme-state helpers if introduced
- renderer-facing view-state reducers or hooks if they contain meaningful logic

### Integration Tests

Focus:

- Copilot CLI detection adapter
- auth-state resolver
- IPC handlers for:
  - startup-state retrieval
  - install-instructions launch
  - GitHub login
  - GitHub Enterprise login
- renderer-to-application state transitions using mocked main-process responses

Use mocks and fixtures for CLI execution wherever possible so tests remain deterministic.

### End-to-End Tests

Milestone 1 does not need broad end-to-end automation. If any end-to-end coverage is added, keep it extremely narrow and limited to shell boot plus a mocked entry-state transition.

### Manual Validation

Required manual checks:

- launch with Copilot CLI unavailable
- launch with Copilot CLI available and unauthenticated
- start GitHub login flow
- start GitHub Enterprise login flow with a host
- verify successful transition into the empty shell
- verify the shell does not expose workspace or chat behaviors that belong to later milestones
- verify dark and light themes both preserve the intended hierarchy

## Recommended Delivery Order

Build in this order:

1. application scaffold and typed boundaries
2. startup-state resolver
3. install gate
4. login flow
5. authenticated empty shell
6. hardening and test coverage

This keeps the most important product journey demonstrable as early as possible while respecting the architecture boundaries defined in the constitution.

## Milestone Completion Definition

Milestone 1 is complete when:

- the app launches successfully as an Electron desktop shell
- the user is blocked by a dedicated install gate when Copilot CLI is missing
- installed but unauthenticated users can begin GitHub or GitHub Enterprise login from the app
- successful authentication transitions into a minimal authenticated shell
- the base shell shows a left rail and a clear `Start a new project` empty state
- the code respects main/preload/renderer boundaries and uses the token-driven UI foundation required for later milestones
