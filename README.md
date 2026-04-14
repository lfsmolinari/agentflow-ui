# agentflow-ui

`agentflow-ui` is a desktop UI for Copilot CLI inspired by the Codex Desktop experience.

The goal is to give Copilot CLI users a workspace-based chat application where they can open project folders, restore prior sessions for each workspace, start new chats, and work with specialized agents through a clear desktop interface.

This project also serves as a proof of concept for the [agentic-engineering-workflow](https://github.com/lfsmolinari/agentic-engineering-workflow) framework.

Phase 1 is focused on a Strategist-first workflow for Product Owners:

- detect whether Copilot CLI is installed
- guide login through GitHub or GitHub Enterprise
- provide a desktop shell with workspace navigation and chat
- treat a folder as a workspace and a new chat as a session inside that workspace
- restore prior sessions for a workspace using Copilot CLI
- show additional agents as future-facing but unavailable

## Project Direction

The current product definition lives in:

- [specs/constitution.md](specs/constitution.md)
- [specs/agentflow-ui-phase-01/product-requirements.md](specs/agentflow-ui-phase-01/product-requirements.md)
- [specs/agentflow-ui-phase-01/user-stories/README.md](specs/agentflow-ui-phase-01/user-stories/README.md)
- [specs/agentflow-ui-phase-01/UX-Stories/README.md](specs/agentflow-ui-phase-01/UX-Stories/README.md)
- [specs/agentflow-ui-phase-01/ui-spec.md](specs/agentflow-ui-phase-01/ui-spec.md)

## Real Example (Dogfooding This Project)

This UI is being built using the Agentic Engineering Workflow itself.

### Phase 1 — Product (Strategist)

- Idea defined through Strategist
- Generated `product-requirements.md`
- Derived user stories

### Phase 2 — UX Design (Designer)

- Generated UX stories
- Produced `ui-spec.md` from product requirements, UX stories, and visual references
- Defined layout, screen states, interaction behavior, and design-token expectations

### Phase 3 — Technical Design (Architect)

- Spec generation for milestone 1
- Plan and task breakdown

### Phase 4 — Implementation (Coder)

- Implementing first user stories

This repository serves as a real-world validation of the workflow.

Artifacts:

- See product requirement: [specs/agentflow-ui-phase-01/product-requirements.md](specs/agentflow-ui-phase-01/product-requirements.md)
- See user stories: [specs/agentflow-ui-phase-01/user-stories/README.md](specs/agentflow-ui-phase-01/user-stories/README.md)
- See UX stories: [specs/agentflow-ui-phase-01/UX-Stories/README.md](specs/agentflow-ui-phase-01/UX-Stories/README.md)
- See UI spec: [specs/agentflow-ui-phase-01/ui-spec.md](specs/agentflow-ui-phase-01/ui-spec.md)
- See Milestone 1 spec: [specs/agentflow-ui-phase-01/Milestone 1/spec.md](specs/agentflow-ui-phase-01/Milestone%201/spec.md)
- See Milestone 1 plan: [specs/agentflow-ui-phase-01/Milestone 1/plan.md](specs/agentflow-ui-phase-01/Milestone%201/plan.md)
- See Milestone 1 tasks: [specs/agentflow-ui-phase-01/Milestone 1/tasks.md](specs/agentflow-ui-phase-01/Milestone%201/tasks.md)

## Planned Stack

- Electron
- React
- TypeScript
- Tailwind CSS
- CSS variables for design tokens
- Radix primitives
- Copilot CLI as the backend runtime

## MVP Summary

- A workspace is a local folder or project
- Each workspace contains multiple chat sessions
- Strategist is the only enabled agent in phase 1
- Other agents may be visible but disabled
- Session continuity should come from Copilot CLI rather than a separate app-owned backend
- The UI should support both dark and light mode through a shared design-token system

## Agent Workflow Notes

- `Strategist` defines product direction, writes the product requirements, and helps derive user stories
- `Designer` translates product and UX stories into UI/UX handoff artifacts such as `ui-spec.md`
- `Architect` turns the approved product and design artifacts into `spec.md`, `plan.md`, and `tasks.md`
- `Coder` implements against those approved artifacts

## Status

The repository is currently in product-definition and planning mode. Specs, constitution, and user stories exist; production application code has not been started yet.

## Licensing

This project is source-available for learning and collaboration.

Commercial use is restricted.

It is licensed under PolyForm Noncommercial 1.0.0. See [LICENSE](LICENSE).

If you're interested in using this in a commercial context, please reach out.
