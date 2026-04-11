# UI Spec: Phase 1 Workspace Chat

## Scope

This UI spec covers all phase 1 UX stories:

- install gate entry experience
- login and authentication choice
- empty shell and first project state
- workspace sidebar navigation
- session list and restoration
- active chat and composer
- disabled agent visibility
- file-context attachment from the composer

It defines the full phase 1 desktop experience from first launch through active Strategist sessions inside a workspace.

## Purpose

Define the phase 1 desktop experience for AgentFlow UI so the product feels calm, intentional, and desktop-native from first launch through active workspace-based Strategist chat.

This spec should help Architect and Coder build the shell, navigation, chat states, and composer behavior without inventing extra flows or exposing unsupported functionality too early.

## Users

- Product Owners using Strategist as the first supported agent
- Copilot CLI users who want a desktop workspace instead of a terminal-first interaction model

## Design Direction

- quiet dark desktop minimalism
- inspired by Codex Desktop layout and restraint, but not a visual clone
- conversation-first product with strong empty-state guidance
- low-noise hierarchy with generous spacing and very few competing actions
- desktop-native tone over marketing-site tone
- stable left-rail navigation with workspace-first organization
- contextual controls instead of global control overload
- built on a token-driven visual system that supports both dark and light themes

## Reference Analysis

The provided mockup and Codex Desktop reference suggest these reusable decisions:

- the left rail should feel persistent, calm, and structurally reliable
- the main panel should have large negative space and one obvious next action
- top chrome should stay light and utility-focused rather than feature-heavy
- entry states should look like product states, not generic modal interruptions
- controls should feel embedded into the workspace shell, not layered as floating dashboards
- session history should feel attached to the selected workspace, not like a separate inbox
- the composer should carry agent and file-context controls without becoming a toolbar-heavy footer

## Visual System

The UI should be implemented with Tailwind CSS using CSS variables as the source of truth for design tokens. Accessible interactive primitives such as menus, dialogs, and popovers may use Radix primitives, but their appearance should be styled through the local token system rather than inherited package themes.

### Color and Tone

- dark charcoal and graphite surfaces
- subtle panel separation rather than high-contrast borders
- restrained accent color used only for the most important action on a screen
- muted secondary text for explanation and metadata
- no decorative gradients, bright AI-brand colors, or glossy card-heavy treatment
- light theme should preserve the same hierarchy and restraint rather than becoming bright SaaS UI

### Typography

- clean sans-serif desktop typography
- strong contrast between page title, primary action, and supporting text
- sidebar labels should be compact and legible, not oversized
- empty-state headlines should feel confident and short, not promotional

### Shape and Density

- medium corner radius on primary surfaces
- compact controls in chrome, roomier controls in the main content area
- consistent padding rhythm with visible breathing room
- cards only where they help frame a small number of suggested actions; avoid dashboard grids

### Design Tokens

The design system should define a small shared token set before implementation begins.

Minimum token groups:

- color
  - background
  - panel
  - elevated panel
  - border
  - primary text
  - secondary text
  - muted text
  - accent
  - accent foreground
  - focus ring
  - destructive
- typography
  - font family
  - font sizes for shell labels, body, headings, and hero empty states
  - line heights for compact lists and chat body text
- spacing
  - tight, compact, default, roomy, and section-level spacing steps
- radius
  - control, panel, modal, and composer radii
- shadow
  - subtle overlay and modal depth tokens only
- motion
  - short durations and restrained easing for menus, dialogs, and state transitions

Implementation note:

- dark and light themes should switch by changing token values, not by rewriting component classes

## Screen Model

There are six major states in scope:

1. install gate
2. login and auth choice
3. authenticated empty shell with no workspace selected
4. workspace selected with session list visible
5. active session with transcript and composer
6. active session with contextual agent and file controls

These should feel like parts of one coherent product, not unrelated screens.

## Information Hierarchy

### Across The Product

- primary: what the user can do next in the current context
- secondary: where they are, which workspace or session is active, and what system state applies
- tertiary: supporting explanation, shell utilities, and future-facing but disabled options

### By State

#### Install Gate

- primary: Copilot CLI is required
- secondary: install action
- tertiary: restart guidance

#### Login

- primary: continue with GitHub
- secondary: GitHub Enterprise path
- tertiary: short explanation of why login is needed

#### Empty Shell

- primary: start a new project
- secondary: understanding that the left rail is where workspaces and sessions will live
- tertiary: decorative or supporting shell chrome

#### Workspace Selected

- primary: prior sessions for the active workspace or the action to start a new chat
- secondary: workspace identity and session grouping
- tertiary: shell utilities and low-priority metadata

#### Active Session

- primary: transcript and composer
- secondary: session identity, selected agent, attached file context
- tertiary: utilities that support but do not distract from the conversation

## Layout

### Install Gate

- full-window dedicated entry screen
- no visible workspace sidebar
- no visible chat transcript or composer
- centered content column inside the window body
- optional small brand mark above the heading
- one clear primary button for install instructions
- short supporting text below or beside the action explaining that restart is required after installation

### Login And Authentication Choice

- full-window dedicated entry screen using the same structural rhythm as the install gate
- centered content column with brand mark, heading, short explanation, and auth actions
- primary GitHub login button
- secondary GitHub Enterprise text action or subtle button beneath the primary path
- GitHub Enterprise host entry appears in a focused modal or popup on top of this screen
- still no workspace sidebar or chat UI before auth completes

### Empty Shell And First Project State

- app transitions into the full desktop shell after successful auth
- persistent left rail appears on the left
- main panel fills the remainder of the window
- top chrome stays sparse and quiet
- left rail contains shell structure but no active workspace content yet
- main panel centers an empty-state composition rather than a fake chat transcript
- the dominant action is `Start a new project`

### Workspace Shell With Active Workspace

- persistent left rail remains visible
- top portion of the left rail contains workspace-level navigation and add-workspace action
- selected workspace is visually distinct
- sessions appear indented beneath the selected workspace
- main panel shows either a workspace-level empty state or the restored or new session content
- new-chat action may appear in the left rail or main shell header once a workspace exists

### Active Chat Session

- main panel becomes a transcript-first chat surface
- transcript occupies the majority of the content region
- composer anchors to the bottom of the main panel
- agent selector is embedded inside or attached to the composer
- file-context attachment originates from the composer area
- no right-side artifact panel in phase 1

## Key Components

### Brand Mark

- appears on install gate and login screen
- simple and compact
- should anchor the product identity without making the screen feel like marketing

### Entry Heading

- one short sentence that explains the state clearly
- examples:
  - `Copilot CLI required`
  - `Sign in to continue`

### Entry Support Text

- one or two short lines only
- should explain what the app depends on and what happens next
- should never read like an error log

### Primary Action Button

- single strongest action on the screen
- install gate: open Copilot install instructions
- login screen: continue with GitHub
- empty shell: start a new project

### Secondary Action

- used sparingly
- on login screen, the GitHub Enterprise path should be secondary but clearly discoverable
- secondary actions must never compete visually with the primary action

### Enterprise Host Modal

- invoked only when the user chooses GitHub Enterprise
- small focused modal, not a full-screen detour
- contains:
  - clear title
  - one host input
  - confirm action
  - cancel action
- no extra explanatory clutter

### Left Rail

- only appears once the user is authenticated
- stable vertical region for workspaces and sessions
- in the empty shell, it should show structure without pretending data exists
- should include a quiet settings or utility anchor near the bottom
- should not try to behave like a full IDE file tree
- workspace items are top-level and session items are nested beneath them

### Workspace Item

- uses folder iconography or a similarly clear project metaphor
- label should be bold or otherwise stronger than session labels
- selected state should be visible but restrained

### Session Item

- visually nested under the workspace
- lighter visual weight than workspace labels
- scannable, compact, and optimized for titles rather than previews in phase 1
- timestamp or recency metadata may appear quietly if needed, but titles remain primary

### Session Empty State

- appears when a workspace has no prior sessions
- should not read like an error
- should naturally lead the user toward starting a new chat

### Chat Transcript

- centered in the main panel with generous side padding
- supports a clean distinction between user and Strategist turns
- should not rely on overly boxed message cards for every message

### Composer

- anchored to the bottom of the main panel
- includes:
  - agent selector
  - text input
  - file-context affordance
  - send action
- should feel like one integrated control surface, not separate floating widgets

### Agent Selector

- located inside the composer area
- behaves more like a model picker than a global navigation element
- only appears when a session is active
- Strategist is selected by default in phase 1
- future agents may be listed but disabled

### File Context Attachment

- originates from the composer area
- attached file paths remain visible before send
- should read as contextual chips, tokens, or inline references rather than full attachments

### Empty-State Panel

- centered inside the main content area
- includes:
  - short headline
  - one sentence of orientation copy
  - prominent `Start a new project` action
- optional subtle illustration or mark is acceptable, but keep it minimal

## State Details

### State 1: Copilot CLI Missing

#### Goals

- stop the user before they enter an unusable app shell
- explain dependency clearly in seconds
- reduce uncertainty about what to do next

#### Content Requirements

- heading states that Copilot CLI is required
- body explains that AgentFlow UI depends on Copilot CLI to run sessions
- install action links to official installation instructions
- support text says to restart the app after installation

#### Behavior

- this is a hard gate
- no bypass
- no preview of shell features behind the gate
- no disabled sidebar or blurred chat area in the background

### State 2: Copilot CLI Installed But Not Authenticated

#### Goals

- keep momentum after the dependency check passes
- make standard GitHub auth feel like the default path
- keep enterprise login accessible without crowding the screen

#### Content Requirements

- heading explains the user is signing in to continue
- GitHub button is primary
- GitHub Enterprise is secondary and opens a modal for host entry
- supporting copy explains that authentication is handled through Copilot CLI

#### Behavior

- after successful login, transition directly to the shell
- if login is cancelled or fails, remain on the login screen with clear feedback
- error feedback should appear inline and calmly, not as a disruptive system alert when avoidable

### State 3: Authenticated, No Workspace Selected

#### Goals

- make the shell feel real even before the first workspace exists
- guide the user toward opening a folder as their first meaningful step
- establish the product's workspace mental model

#### Content Requirements

- left rail visible but empty of real workspace data
- main empty state explains that projects begin by adding a folder
- primary call to action: `Start a new project`

#### Behavior

- clicking `Start a new project` should lead into folder selection
- the empty shell should not show the composer yet, because there is no active session
- the screen should not imply an active Strategist conversation before a project exists

### State 4: Workspace Selected, No Active Session

#### Goals

- establish that the workspace is now the active project context
- make session history feel relevant and local to that workspace
- provide a clear path into either restoring work or starting a new chat

#### Content Requirements

- active workspace visibly selected in the left rail
- session list shown under that workspace
- calm empty state when no sessions exist
- clear `New chat` action for the active workspace

#### Behavior

- selecting a workspace updates the visible session list
- workspaces other than the active one remain visible but visually secondary
- if no sessions exist, the main panel or nested sidebar area should guide the user to start one

### State 5: Active Session

#### Goals

- make the conversation feel like the center of gravity
- keep project context nearby but not dominant
- ensure the composer is always easy to find and understand

#### Content Requirements

- transcript visible in the main panel
- session title or identifying label available but not oversized
- composer with Strategist shown as selected agent
- room for file-context attachment

#### Behavior

- selecting a session restores it into the main panel
- starting a new chat creates a fresh session under the selected workspace
- the transcript area should scroll independently of the left rail

### State 6: Active Session With Disabled Future Agents

#### Goals

- communicate the broader multi-agent direction
- avoid implying unsupported capabilities are broken

#### Content Requirements

- Strategist selected by default
- future agents such as Architect or Reviewer may appear in the selector
- disabled entries must be visibly unavailable

#### Behavior

- disabled agents cannot be selected
- the selector should not appear before a session exists
- availability messaging should be quiet and informative

### State 7: Active Session With File Context

#### Goals

- make file references feel native to chat
- preserve a clean composer

#### Content Requirements

- file-path references visible before send
- attached items remain compact and readable

#### Behavior

- file context is attached from the composer region
- invalid file references produce clear but non-disruptive feedback
- file context should be scoped to the active workspace

## Interactions

### Install Gate

- `Install Copilot CLI` opens the installation instructions in the user's browser
- screen remains in place after the external link opens
- copy should instruct the user to restart the app after installation

### Login Screen

- `Continue with GitHub` starts the standard Copilot CLI login flow
- `GitHub Enterprise` opens the host-entry modal
- confirming the enterprise modal starts `copilot login --host` with the provided host
- canceling the enterprise modal returns the user to the login screen with no state loss

### Empty Shell

- `Start a new project` opens folder selection
- no chat controls, composer actions, or agent selector are available yet
- the left rail should feel ready for future workspace content, but not interactive beyond the actions relevant to this state

### Workspace Sidebar

- selecting a workspace updates the session context beneath it
- plus action adds another workspace without disrupting the current visual model
- nested sessions should expand within the workspace context rather than navigating to a new screen

### Session List

- selecting a session restores it into the active main panel
- selecting `New chat` in a workspace creates a new session within that workspace
- session changes should feel like context restoration, not full page changes

### Active Composer

- agent selector opens from the composer area
- Strategist is the active option
- entering text and attaching file context happen in the same control zone
- send action should remain visually available but not oversized

### Disabled Agents

- opening the selector reveals future agents in a disabled state
- disabled entries may include subtle explanatory copy or tooltip treatment
- no disabled agent may trigger navigation or state change

### File Context

- adding file context should feel like extending the prompt, not uploading a document
- attached file references remain visible until removed or sent
- removal must be easy and low-friction

## Content Guidance

### Tone

- clear
- calm
- direct
- product-focused
- no terminal jargon unless necessary

### Preferred Labels

- `Copilot CLI required`
- `Install Copilot CLI`
- `Restart AgentFlow UI after installation`
- `Sign in to continue`
- `Continue with GitHub`
- `GitHub Enterprise`
- `Enter enterprise host`
- `Start a new project`
- `New chat`
- `Workspaces`
- `No chats yet`

### Avoid

- alarming error language
- marketing slogans
- vague empty-state copy like `Nothing here yet`
- chat placeholder text before a workspace and session exist
- file-explorer jargon in the workspace rail
- floating mode labels disconnected from the composer

## Sidebar Structure Guidance

The left rail should follow this hierarchy:

- top-level workspace area with a plus affordance
- each workspace shown as a folder-like container
- sessions nested beneath the workspace
- utility anchor such as settings pinned near the bottom

Example structure:

- AgentFlow UI
  - MVP Definition
  - Authentication Feature
  - Dashboard Idea
- User Research
  - Competitive Analysis
- Product Roadmap
  - No chats yet

## Accessibility Notes

- keyboard focus must be obvious on all entry actions and modal controls
- install gate, login screen, and modal must be fully navigable without a mouse
- heading and action order should make sense to screen readers
- secondary actions must remain readable against dark surfaces
- disabled or unavailable controls should not be the primary communication mechanism in these first three states
- modal focus must trap correctly and return to the triggering control on close
- workspace and session items should be navigable by keyboard in the left rail
- active workspace and active session must be communicated through more than color alone
- disabled agents must expose their unavailable state to assistive technology
- attached file-context tokens must be individually focusable and removable by keyboard

## Notes For Architect And Coder

- keep install gate and login as dedicated pre-shell states rather than rendering the full shell and overlaying blockers
- the shell should only appear after auth succeeds
- the empty authenticated shell is structurally different from an active workspace session: no composer, no agent picker, no transcript
- enterprise host entry should be modeled as a small focused flow, not a permanent form field on the login screen
- the left rail in the empty shell should establish spacing, navigation rhythm, and bottom utility placement that later workspace and session states can inherit
- if local state is needed for entry-state transitions, keep it minimal and aligned with the constitution's rule that auth remains owned by Copilot CLI
- once a workspace exists, keep the left rail stable across empty, populated, and restored session states
- the agent selector belongs to the composer, not the global shell chrome
- do not add a right-side artifact panel in phase 1
- session history should prioritize clear titles and hierarchy over dense metadata
- file-context UI should remain lightweight enough that the composer still reads primarily as a chat input
- implement styling through Tailwind utility composition backed by CSS variables for shared tokens
- use Radix primitives where accessible behavior is complex, but keep visuals fully controlled by local styles and tokens

## Assumptions

- window chrome can remain native or lightly customized, but this spec does not require a custom draggable title bar
- there is a lightweight brand mark available for entry screens, even if temporary in phase 1
- folder selection for `Start a new project` resolves into a workspace in the left rail
- session titles are available or derivable for sidebar display, even if the exact title-generation logic is defined elsewhere
