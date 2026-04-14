---
name: architecture-principles
description: Use when reviewing architecture decisions, implementation plans, or PRs against layering, boundaries, and system design expectations.
---

## Purpose

Provides architecture review criteria for evaluating design decisions, implementation plans, and PRs against layering, boundaries, and system design expectations.

## When to Use

Use this skill when the task involves architecture trade-offs, design reviews, implementation plans, or PR reviews with architecture concerns.

## Rules

### Boundaries and Layering
- Are boundaries respected between UI, application, domain, and infrastructure layers?
- Is domain logic staying out of transport and persistence concerns?
- Are cross-module dependencies intentional and minimal?
- Does the design follow the dependency rule — dependencies point inward, not outward?

### Simplicity
- Is the chosen approach simpler than the next obvious alternative while still meeting requirements?
- Are abstractions justified by concrete, current needs — not hypothetical future ones?
- Does the design use framework capabilities directly rather than wrapping them unnecessarily?

### Consistency
- Does the design match existing patterns in the codebase?
- Are new patterns introduced only when existing ones are insufficient?
- Is the naming and structure consistent with the rest of the project?

### Resilience
- Are retries, idempotency, ordering, and observability considered when the change affects async or distributed behavior?
- Does the design preserve backward compatibility where relevant?
- Are failure modes explicit and recoverable?

### Modularity
- Can each component be understood, tested, and modified independently?
- Are interfaces stable enough to survive implementation changes?
- Is shared state minimized across boundaries?

## When Producing Feedback

- Prefer concrete risks over abstract principles.
- Call out hidden coupling and unclear ownership.
- Distinguish must-fix concerns from optional improvements.
- Reference the project constitution (`specs/constitution.md`) when it defines relevant standards.

## Checklist

- [ ] Boundaries between layers are respected
- [ ] Dependencies point inward, not outward
- [ ] Simplest approach that meets requirements is chosen
- [ ] Existing codebase patterns are followed
- [ ] New patterns are justified by concrete needs
- [ ] Failure modes are explicit and recoverable
- [ ] Components can be understood and tested independently
