# Implementation Plan: [Feature Name]

> **Instructions for the Architect agent**: Transform the feature specification into a phased technical plan. Every decision must trace back to a spec requirement. Reference `specs/constitution.md` for technology choices and architecture standards. Keep this document high-level — extract detailed algorithms, schemas, or API contracts to separate files in the feature directory.

## Status

- **Created**: [date]
- **Spec**: `specs/[feature-name]/spec.md`
- **Status**: Draft | Ready for Review | Approved
- **Author**: [human or agent]

## Technical Summary

[1-2 paragraphs: What will be built technically, which approach was chosen, and why.]

## Architecture Decisions

### Decision 1: [Title]

- **Context**: [Why this decision is needed]
- **Options considered**: [Brief list]
- **Chosen approach**: [What and why]
- **Spec reference**: [Which user story or requirement drives this]
- **Trade-offs**: [What we gain, what we accept]

### Decision 2: [Title]

- **Context**: [Why this decision is needed]
- **Options considered**: [Brief list]
- **Chosen approach**: [What and why]
- **Spec reference**: [Which user story or requirement drives this]
- **Trade-offs**: [What we gain, what we accept]

## Impacted Areas

| Area | Impact | Files/Modules Likely Affected |
|------|--------|-------------------------------|
| [e.g., Database] | [New table / migration] | [files] |
| [e.g., API layer] | [New endpoint] | [files] |
| [e.g., UI] | [New component] | [files] |

## Implementation Phases

### Phase 1: [Foundation]

**Goal**: [What this phase accomplishes]
**Prerequisite**: None

- [ ] [Step 1]
- [ ] [Step 2]
- [ ] [Step 3]

**Validation**: [How to verify this phase is complete]

### Phase 2: [Core Feature]

**Goal**: [What this phase accomplishes]
**Prerequisite**: Phase 1 complete

- [ ] [Step 1]
- [ ] [Step 2]

**Validation**: [How to verify this phase is complete]

### Phase 3: [Integration and Polish]

**Goal**: [What this phase accomplishes]
**Prerequisite**: Phase 2 complete

- [ ] [Step 1]
- [ ] [Step 2]

**Validation**: [How to verify this phase is complete]

## Test Strategy

- **Unit tests**: [What business logic needs unit tests]
- **Integration tests**: [What module boundaries need integration tests]
- **E2E tests**: [What critical user paths need end-to-end tests]
- **Manual verification**: [What needs human validation]

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | Low/Med/High | Low/Med/High | [How to mitigate] |
| [Risk 2] | Low/Med/High | Low/Med/High | [How to mitigate] |

## Open Questions

- [Technical question 1]
- [Technical question 2]

---

## Pre-Implementation Gates

### Simplicity Gate
- [ ] Is this the simplest approach that meets the spec requirements?
- [ ] No speculative or "might need" features included?
- [ ] Using existing framework capabilities directly (no unnecessary wrappers)?

### Consistency Gate
- [ ] Follows existing codebase patterns?
- [ ] Aligns with project constitution?
- [ ] No new patterns introduced without clear justification?

### Completeness Gate
- [ ] Every spec requirement is addressed by at least one phase?
- [ ] Test strategy covers all acceptance criteria?
- [ ] Risks are identified with mitigations?

## Plan Quality Checklist

- [ ] Every technical decision traces to a spec requirement
- [ ] Phases are ordered and have clear prerequisites
- [ ] Impacted areas and file scope are identified
- [ ] Test strategy is concrete, not generic
- [ ] No `[NEEDS CLARIFICATION]` markers remain
- [ ] Plan aligns with project constitution
