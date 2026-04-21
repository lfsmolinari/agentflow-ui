# Task Breakdown: [Feature Name]

> **Instructions for the Architect agent**: Decompose the implementation plan into executable tasks. Each task should be completable in a single focused session. Every task must reference the plan section it implements. Mark parallelizable tasks with `[P]`.

## Status

- **Created**: [date]
- **Spec**: `specs/[feature-name]/spec.md`
- **Plan**: `specs/[feature-name]/plan.md`
- **Status**: Draft | Ready for Review | Approved
- **Author**: [human or agent]

## Summary

- **Total tasks**: [count]
- **Parallelizable tasks**: [count]
- **Estimated phases**: [count]

## Task Dependency Graph

```
[T1] → [T2] → [T4]
           ↘
[T1] → [T3] → [T5]
               ↗
       [T3] [P]
```

> Replace with the actual dependency flow for this feature.

## Tasks

### T1: [Short descriptive title]

- **Plan reference**: Phase 1, Step 1
- **Dependencies**: None
- **Parallel**: No (foundation task)
- **Files likely affected**: [list]

**Description**: [1-2 sentences — what to do]

**Acceptance**: [How to verify this task is complete]

---

### T2: [Short descriptive title]

- **Plan reference**: Phase 1, Step 2
- **Dependencies**: T1
- **Parallel**: No
- **Files likely affected**: [list]

**Description**: [1-2 sentences — what to do]

**Acceptance**: [How to verify this task is complete]

---

### T3: [Short descriptive title] [P]

- **Plan reference**: Phase 2, Step 1
- **Dependencies**: T1
- **Parallel**: Yes — can run alongside T2
- **Files likely affected**: [list]

**Description**: [1-2 sentences — what to do]

**Acceptance**: [How to verify this task is complete]

---

### T4: [Short descriptive title]

- **Plan reference**: Phase 2, Step 2
- **Dependencies**: T2, T3
- **Parallel**: No
- **Files likely affected**: [list]

**Description**: [1-2 sentences — what to do]

**Acceptance**: [How to verify this task is complete]

---

### T5: [Test coverage]

- **Plan reference**: Test Strategy
- **Dependencies**: T4
- **Parallel**: No
- **Files likely affected**: [test files]

**Description**: [Write tests for the acceptance criteria defined in the spec]

**Acceptance**: [All acceptance criteria from spec.md have corresponding passing tests]

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| T1 | ⬜ Not started | |
| T2 | ⬜ Not started | |
| T3 | ⬜ Not started | |
| T4 | ⬜ Not started | |
| T5 | ⬜ Not started | |

Status legend: ⬜ Not started · 🔄 In progress · ✅ Complete · ⏸️ Blocked

---

## Task Quality Checklist

- [ ] Every task is actionable — a coder can start without asking questions
- [ ] Every task has clear acceptance criteria
- [ ] Dependencies are explicit — no implicit ordering
- [ ] Parallelizable tasks are marked with [P]
- [ ] The full task list covers the entire plan
- [ ] No task mixes unrelated concerns
- [ ] Infrastructure/setup tasks come before feature tasks
- [ ] Test tasks are included
- [ ] Every task references its plan section
