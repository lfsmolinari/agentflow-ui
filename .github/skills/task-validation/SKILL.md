---
name: task-validation
description: Use before marking any task complete. Runs the project's validation suite (lint, typecheck, tests) and confirms the implementation is in a working state. Use this whenever you have finished implementing a task and need to verify it before calling task_complete.
---

## Purpose

Prevents agents from finishing tasks in a broken state. Run this validation sequence after every implementation task and before calling `task_complete`.

## When to Use

- After implementing any code change
- After fixing a bug or applying a patch
- Before calling `task_complete` on any coding task
- When you are unsure whether your changes introduced regressions

## How to Run

The exact commands, scripts, test folders, and e2e trigger conditions are defined in `specs/constitution.md` under **Testing Standards**. Read that section first.

The general sequence is:

1. **Typecheck** — compile without emitting; must exit 0
2. **Lint** — static analysis; must exit 0 with no errors (warnings are acceptable)
3. **Unit / integration tests** — run the full test suite once; all tests must pass
4. **Build** (conditional) — run if your change touches configuration, build paths, aliases, or bundling
5. **End-to-end tests** (conditional) — run if your change affects a flow covered by the project's e2e suite; see the constitution for which flows require this

## Pre-Completion Checklist

Before calling `task_complete`, confirm:

- [ ] Typecheck exits 0
- [ ] Lint exits 0 (no errors)
- [ ] All unit/integration tests pass
- [ ] No new unhandled errors or silent failure paths introduced without intent
- [ ] If build-related changes were made, build also exits 0
- [ ] If the change affects a flow listed in the constitution's e2e trigger conditions, e2e tests pass

## Handling Failures

**Type errors**: Fix the type error — do not suppress with casts or ignore comments unless explicitly justified.

**Lint errors**: Fix the violation — do not disable rules inline unless the rule is genuinely inapplicable and you can justify it.

**Test failures**:
- If a test you wrote is failing, fix the implementation, not the test
- If a pre-existing test is failing due to your change, consider whether your change broke a contract — fix the root cause
- Only update a test if the behavior it tested has legitimately changed per the spec

**Build failures**: Resolve in the source. Only touch config if the config is the actual cause.

**E2E failures**: Consult the failure interpretation guidance in `specs/constitution.md`.
