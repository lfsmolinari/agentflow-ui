---
name: pr-review-checklist
description: Use when reviewing a change against spec intent, correctness, maintainability, and test coverage.
---

## Purpose

Provides a systematic review checklist that validates code changes against the full traceability chain: code → tasks → plan → spec.

## When to Use

Use this skill during PR review to ensure systematic coverage of all review dimensions.

## Review Order

1. **Spec alignment** — Does the change solve the intended problem as specified?
2. **Acceptance criteria** — Are the acceptance criteria from the spec covered?
3. **Correctness** — Are there logic errors, race conditions, or unhandled edge cases?
4. **Scope** — Does the change stay within the planned scope — no more, no less?
5. **Architecture** — Does it fit existing patterns and respect module boundaries?
6. **Test coverage** — Are tests sufficient for the level of risk introduced?
7. **Operational readiness** — Are logging, error handling, retry, and rollback considered?

## Spec Traceability Check

When a spec exists (`specs/[feature]/spec.md`):
- Verify code implements what `tasks.md` describes
- Verify tasks align with `plan.md`
- Verify plan aligns with `spec.md`
- Map each changed file/function to a spec requirement
- Identify requirements that have no corresponding code change
- Identify code changes that have no corresponding requirement (scope creep)
- Flag acceptance criteria that cannot be verified by existing tests

## Output Format

Follow the structured report format defined in the PR Reviewer agent:

1. **Summary** — what was reviewed, which mode (A/B), overall assessment
2. **Spec Traceability table** — each requirement mapped to Met / Missing / Partial / Deviated
3. **Metrics** — files changed, complexity estimate, test coverage gaps
4. **Findings table** — severity-rated (🔴🟠🟡🔵), domain, file:line, issue, justification, suggested fix
5. **Recommended Actions** — checkboxes separating must-fix from should-improve
6. **Risk Level** — Low / Medium / High with one-line justification

## Checklist

- [ ] Change solves the intended problem as specified
- [ ] All acceptance criteria are addressed
- [ ] Scope matches task list — no more, no less
- [ ] Implementation follows plan's technical decisions
- [ ] Existing codebase patterns are respected
- [ ] Tests are sufficient for the risk level
- [ ] Must-fix and should-improve concerns are separated
