---
name: qa-review-checklist
description: Use when validating test strategy, coverage gaps, and acceptance criteria traceability post-implementation.
---

## Purpose

Provides a systematic QA review framework for validating test strategy, coverage gaps, and acceptance criteria traceability post-implementation.

## When to Use

Use this skill during QA review to validate that the implementation is adequately tested against the specification.

## Review Order

1. **Acceptance criteria mapping** — Does every criterion have a test?
2. **Coverage gaps** — What scenarios are untested?
3. **Test quality** — Do tests validate behavior, not implementation?
4. **Edge cases** — Are boundary conditions and failure paths covered?
5. **Test maintainability** — Will tests survive a refactor?

## Acceptance Criteria Matrix

Build a traceability matrix:

| Acceptance Criterion (from spec) | Test(s) that cover it | Status |
|---|---|---|
| [criterion 1] | [test name/file] | ✅ Covered / ❌ Missing / ⚠️ Partial |

## Coverage Gap Categories

- **Happy path gaps** — primary success scenarios not tested
- **Error path gaps** — failure modes not tested
- **Edge case gaps** — boundary conditions not tested
- **Integration gaps** — module boundaries not tested
- **State gaps** — state transitions not verified

## Test Quality Signals

Good tests:
- Describe a user-facing scenario in the test name
- Have a clear Given/When/Then structure
- Use realistic data, not trivial fixtures
- Assert on observable behavior, not internal state
- Can run independently and repeatedly

Bad tests:
- Test implementation details (method calls, internal state)
- Depend on execution order
- Use excessive mocking that hides real behavior
- Have unclear assertions or assert too many things

## Output Format

Follow the structured report format defined in the QA agent:

1. **Summary** — what was reviewed, overall test health assessment
2. **Acceptance Criteria Coverage table** — each AC mapped to its test(s) with Covered / Missing / Partial status
3. **Metrics** — AC counts (covered/partial/missing), test types present, estimated untested risk surface
4. **Findings table** — severity-rated (🔴🟠🟡🔵), category, area, issue, and a concrete Given/When/Then suggested test
5. **Recommended Actions** — checkboxes with specific test scenarios to write
6. **Risk Level** — Low / Medium / High with one-line justification

## Checklist

- [ ] Every acceptance criterion has at least one test
- [ ] Happy path, error paths, and edge cases are covered
- [ ] Tests validate behavior, not implementation details
- [ ] Tests would survive a refactor
- [ ] No flaky or order-dependent tests
- [ ] Integration boundaries are tested
- [ ] Missing scenarios are documented with priority
