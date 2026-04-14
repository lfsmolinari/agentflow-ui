---
name: spec-generation
description: Use when creating or reviewing feature specifications. Defines the structure and quality standards for specs.
---

## Purpose

Defines the structure and quality standards for feature specifications. A spec is the source of truth that drives planning, implementation, and review.

## When to Use

Use this skill when generating a new feature specification or reviewing an existing one for completeness.

## Specification Purpose

A spec defines **what** to build and **why** — never **how**. It is the source of truth that drives planning, implementation, and review. A well-written spec should be:

- **Complete enough** to generate a technical plan without guessing
- **Testable** — every requirement has verifiable acceptance criteria
- **Honest about unknowns** — ambiguities are marked, not hidden

## Key Rules

### Separate What from How
- ✅ Describe user needs, behaviors, and outcomes
- ✅ Define constraints, rules, and acceptance criteria
- ❌ Do not specify technology choices, APIs, or code structure
- ❌ Do not include implementation details — those belong in the plan

### Mark Ambiguities
When a requirement is not specified by the user, do not guess. Mark it:

```
[NEEDS CLARIFICATION: What authentication method should be used — email/password, SSO, or OAuth?]
```

### Write Testable Acceptance Criteria
Each user story or requirement must have acceptance criteria that can be verified:

- **Given** [precondition]
- **When** [action]
- **Then** [observable outcome]

### Reference the Constitution
Check `specs/constitution.md` for project principles that constrain the specification (e.g., supported platforms, security requirements, performance targets).

## Spec Quality Checklist

### Completeness
- [ ] Problem statement is clear and specific
- [ ] User stories cover the primary use cases
- [ ] Acceptance criteria exist for every user story
- [ ] No `[NEEDS CLARIFICATION]` markers remain unresolved (or are explicitly deferred)
- [ ] Edge cases and error scenarios are addressed
- [ ] Success criteria are measurable

### Scope
- [ ] The spec defines what is in scope and what is out of scope
- [ ] No speculative "nice to have" features are included
- [ ] The size is appropriate for a single implementation cycle

### Consistency
- [ ] Requirements do not contradict each other
- [ ] Terminology is consistent throughout
- [ ] The spec aligns with the project constitution

## Output

The spec should be created as `specs/[feature-name]/spec.md` following the template at `specs/templates/spec.md`. The spec must align with the template structure — all template sections must be present.
