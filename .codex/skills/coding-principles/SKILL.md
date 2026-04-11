---
name: coding-principles
description: Use when implementing code changes to ensure quality, consistency, and maintainability.
---

## Purpose

Provides code quality standards for writing and reviewing implementation code to ensure consistency and maintainability.

## When to Use

Use this skill when writing or reviewing implementation code to enforce consistent quality standards.

## Rules

### Clarity Over Cleverness
- Prefer simple, explicit code over clever abstractions.
- Keep control flow readable — avoid deep nesting and complex conditionals.
- Use descriptive names for variables, functions, and types.
- Comment only for invariants, assumptions, or non-obvious requirements — not for what the code already says.

### Errors Are First-Class
- Make errors explicit and useful — include context about what failed and why.
- Handle errors at the appropriate level — don't catch and ignore.
- Prefer fail-fast behavior for programming errors.
- Validate at system boundaries (API inputs, file reads, config) — not at every internal call.

### Minimal Coupling
- Minimize dependencies between modules.
- Avoid introducing abstractions that do not clearly pay for themselves.
- Prefer composition over inheritance.
- Keep interfaces small and focused.

### Testability
- Prefer deterministic, testable behavior.
- Avoid hidden side effects and global state.
- Design for dependency injection where it simplifies testing.
- Write code that can be tested without elaborate mocking.

### Consistency
- Match existing codebase patterns and conventions.
- Before introducing new patterns, check whether the repository already has an established way to solve the same problem.
- Follow the project constitution (`specs/constitution.md`) for project-specific standards.

### Scope Discipline
- Keep changes scoped to the task.
- Do not refactor unrelated code unless explicitly asked.
- When you spot improvement opportunities outside the current scope, note them as follow-up — do not mix them in.

## Checklist

- [ ] Code is simple and explicit — no unnecessary cleverness
- [ ] Control flow is readable — no deep nesting
- [ ] Errors are explicit and useful
- [ ] Coupling is minimal — no unjustified abstractions
- [ ] Existing codebase patterns are followed
- [ ] Changes are scoped to the task
