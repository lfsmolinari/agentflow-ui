---
name: task-breakdown
description: Use when decomposing an implementation plan into executable tasks with dependencies and sizing.
---

## Purpose

Defines how to decompose an implementation plan into executable, dependency-aware tasks with proper sizing and acceptance criteria.

## When to Use

Use this skill when breaking down an implementation plan into a concrete, executable task list.

## Task Breakdown Purpose

A task list bridges the gap between the plan (what to build technically) and the implementation (what to do next). Each task should be a single, completable unit of work that an agent or developer can execute in one session.

## Key Rules

### Task Sizing
- Each task should be completable in a single focused session (roughly 1-2 files changed).
- If a task requires changing more than 3-4 files, split it.
- If a task description needs more than 2-3 sentences, it's too broad.

### Traceability
- Every task must reference the plan section it implements.
- Every plan section must be covered by at least one task.
- No task should exist without a plan justification.

### Dependencies
- Mark tasks that depend on other tasks: `depends: [task-id]`
- Mark tasks that can run in parallel: `[P]`
- Order tasks so that foundational work comes first.

### Task Structure

Each task should include:

```markdown
### Task [ID]: [Short descriptive title]

**Plan reference**: [Section of plan.md this implements]
**Dependencies**: [task IDs, or "none"]
**Parallel**: [Yes/No]
**Files likely affected**: [list of files]

**Description**: [1-2 sentences — what to do]

**Acceptance**: [How to verify this task is complete]
```

## Task Quality Checklist

- [ ] Every task is actionable — a coder can start without asking questions
- [ ] Every task has clear acceptance criteria
- [ ] Dependencies are explicit — no implicit ordering assumptions
- [ ] Parallel tasks are marked for efficiency
- [ ] The full task list covers the entire plan — nothing is missed
- [ ] No task mixes unrelated concerns (e.g., UI + database in one task)
- [ ] Infrastructure/setup tasks come before feature tasks
- [ ] Test tasks are included, not assumed

## Output

The task list should be created as `specs/[feature-name]/tasks.md` following the template at `specs/templates/tasks.md`. Tasks must produce a dependency-aware execution graph — not a flat list.
