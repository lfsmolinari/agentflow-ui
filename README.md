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

- [specs/constitution.md](/Users/lmolinari/Developer/agentflow-ui/specs/constitution.md)
- [specs/agentflow-ui-phase-01/product-requirements.md](/Users/lmolinari/Developer/agentflow-ui/specs/agentflow-ui-phase-01/product-requirements.md)
- [specs/agentflow-ui-phase-01/user-stories/README.md](/Users/lmolinari/Developer/agentflow-ui/specs/agentflow-ui-phase-01/user-stories/README.md)

## Planned Stack

- Electron
- React
- TypeScript
- Copilot CLI as the backend runtime

## MVP Summary

- A workspace is a local folder or project
- Each workspace contains multiple chat sessions
- Strategist is the only enabled agent in phase 1
- Other agents may be visible but disabled
- Session continuity should come from Copilot CLI rather than a separate app-owned backend

## Status

The repository is currently in product-definition and planning mode. Specs, constitution, and user stories exist; production application code has not been started yet.

## Licensing

This project is source-available for learning and collaboration.

Commercial use is restricted.

It is licensed under PolyForm Noncommercial 1.0.0. See [LICENSE](/Users/lmolinari/Developer/agentflow-ui/LICENSE).

If you're interested in using this in a commercial context, please reach out.
