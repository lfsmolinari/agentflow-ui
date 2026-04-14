# Global Repository Instructions

These instructions are loaded by GitHub Copilot for all interactions in this repository.

## Workflow

This project uses **Spec-Driven Development (SDD)** with an agent pipeline. The workflow is:

1. **Specify** — Define what to build in `specs/[feature]/spec.md`
2. **Plan** — Define how to build it in `specs/[feature]/plan.md`
3. **Task** — Break the plan into executable tasks in `specs/[feature]/tasks.md`
4. **Implement** — Execute tasks following the plan
5. **Review** — Validate code against the spec

## Key References

- **Constitution**: `specs/constitution.md` — project principles and standards. Read before making architectural decisions.
- **Feature specs**: `specs/[feature]/` — specifications, plans, and tasks for each feature.
- **Templates**: `specs/templates/` — templates for creating new specs, plans, and tasks.

## Standards

- Follow existing codebase patterns before introducing new ones.
- Keep changes scoped to the current task.
- Mark uncertainties explicitly rather than guessing.
- Reference the constitution for project-specific conventions.

## Validation

Before marking any task complete, invoke the `task-validation` skill. It will direct you to the validation suite defined in `specs/constitution.md` under **Testing Standards → Validation Suite**. Do not call `task_complete` if any required step fails. **Tasks that produce user-visible behavior changes must include E2E test coverage; `npm run test:e2e` must pass.**
