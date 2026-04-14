# Tasks: Windows Copilot CLI Detection Fix

## Status

- **Created**: 2026-04-14
- **Status**: Implemented
- **Author**: Architect
- **Scope**: `command-runner.ts` env fix, supporting unit tests, stale assertion update

## Documentation Inputs

- `specs/windows-cli-detection/spec.md`
- `specs/windows-cli-detection/plan.md`

## Parallelization Notes

- **T1** and **T3a / T3b** are independent and can be executed in parallel.
- **T2** is a read-only verification step and can be done in parallel with T1.
- **T4** and **T5** depend on all prior tasks being complete and must run last, in order.

---

## Phase 1: Fix `command-runner.ts`

### T1. Replace env whitelist with full `process.env` passthrough

**Plan reference**: Phase 1

**Dependencies**: None

**Files affected**:
- `src/infrastructure/system/command-runner.ts`

**Description**:
Remove the hand-rolled env whitelist (the destructured variable list and the
`Object.fromEntries` construction) and replace it with `const env = { ...process.env }`.
Remove the `if (process.platform === 'win32')` block that appends npm and NVM directories
to PATH — it is superseded by full env passthrough. Keep `shell: process.platform ===
'win32'` and all other spawn configuration, timeout logic, and stdio handling unchanged.

**Acceptance criteria**:
- The `env` object passed to `spawn()` is `{ ...process.env }` with no manual filtering
  or augmentation.
- No `PATHEXT`, `PATH`, `HOME`, `USERPROFILE`, or similar variable is listed by name in
  `createCommandRunner()`.
- The Windows-specific PATH augmentation `if` block is absent.
- `shell: process.platform === 'win32'` is present and unchanged.
- No other logic in the file is altered.

---

## Phase 2: Verify `adapter.ts` requires no changes

### T2. Confirm `CopilotCliAdapter` is correct as-is (no-op)

**Plan reference**: Phase 2

**Dependencies**: None

**Files affected**: None (read-only verification)

**Description**:
Read `src/infrastructure/copilot/adapter.ts` and confirm that the command name `copilot`
is correct, that `isInstalled()` already handles exit-0, non-zero exit, thrown exceptions,
and the VS Code shim edge case, and that no other adapter method is affected. Do not
modify the file.

**Acceptance criteria**:
- `adapter.ts` is reviewed and confirmed unchanged.
- No diff is produced for this file.
- The decision that no adapter changes are needed is recorded in the task log or PR
  description.

---

## Phase 3: Unit test additions

### T3a. Add env passthrough unit test to `command-runner.test.ts`

**Plan reference**: Phase 3a

**Dependencies**: T1

**Files affected**:
- `tests/infrastructure/command-runner.test.ts`

**Description**:
Add one test that verifies the spawned child process inherits a variable from
`process.env`. Before the test, write a known value into `process.env.TEST_RUNNER_CHECK`.
Run a cross-platform command (`node -e "process.stdout.write(process.env.TEST_RUNNER_CHECK)"`)
via the runner and assert the output contains the expected value. Clean up the env var in
`afterEach` or a `finally` block.

**Acceptance criteria**:
- A test named (approximately) `'passes host env to spawned process'` exists and passes.
- The test sets and cleans up `process.env.TEST_RUNNER_CHECK`.
- No existing `command-runner.test.ts` tests are modified or broken.
- `npm test` passes with the new test included.

---

### T3b. Add runner-throws edge case test to `adapter.test.ts`

**Plan reference**: Phase 3b

**Dependencies**: None (independent of T1 and T3a)

**Files affected**:
- `tests/infrastructure/copilot/adapter.test.ts`

**Description**:
Add one test that confirms `isInstalled()` resolves to `false` rather than propagating
when the underlying `CommandRunner.run()` throws. Create a `CommandRunner` mock whose
`run` method throws `new Error('spawn ENOENT')` and pass it to the adapter. Assert that
`adapter.isInstalled()` resolves to `false`.

**Acceptance criteria**:
- A test named (approximately) `'returns false when runner throws'` exists and passes.
- The test does not modify any existing test case.
- `npm test` passes with the new test included.

---

## Phase 4: Update stale assertion message in `startup.e2e.ts`

### T4. Update stale error hint message in E2E test

**Plan reference**: Phase 4

**Dependencies**: T1, T2, T3a, T3b

**Files affected**:
- `tests/e2e/startup.e2e.ts`

**Description**:
In the `'shows login screen when Copilot CLI is installed'` test, locate the assertion
failure message that currently reads `"Check src/infrastructure/system/command-runner.ts
PATH augmentation."` and update it to `"Check src/infrastructure/system/command-runner.ts
env configuration."`. No other changes to the E2E file.

**Acceptance criteria**:
- The string `"PATH augmentation"` no longer appears in `startup.e2e.ts`.
- The string `"env configuration"` is present in the updated assertion message.
- No other lines in the E2E file are modified.

---

## Phase 5: Validation

### T5. Run full validation suite

**Plan reference**: Phase 5

**Dependencies**: T1, T2, T3a, T3b, T4

**Files affected**: None (read-only execution)

**Description**:
Run the four validation steps in order: `npm run typecheck`, `npm run lint`, `npm test`,
then `npm run test:e2e`. All must pass. The E2E suite requires Copilot CLI to be installed
on the machine at a location present in the registry PATH; if the CLI is not installed,
the second E2E test (`'shows login screen when Copilot CLI is installed'`) will fail by
design — that is not a code defect.

**Acceptance criteria**:
- `npm run typecheck` exits 0.
- `npm run lint` exits 0.
- `npm test` exits 0, including the two new tests from T3a and T3b.
- `npm run test:e2e` exits 0 on a machine where Copilot CLI is installed on the registry
  PATH.
- No regressions introduced in any existing test.

---

## Phase 6: Optimize startup auth refresh (T6 addendum)

### T6. Optimize `refreshAuthState()` and guard mid-session CLI removal

**Plan reference**: T6 addendum — post-plan change; see spec.md Non-Goals for alignment note

**Dependencies**: T1

**Files affected**:
- `src/main/startup-service.ts`

**Description**:
After login, `refreshAuthState()` was calling `getStartupState()`, which internally ran
`isInstalled()` followed by `probeAuthState()` — two sequential CLI spawns. At the point
`refreshAuthState()` is called, CLI presence is already confirmed, so the `isInstalled()`
call is redundant and introduces noticeable latency. Replace it with a direct call to
`probeAuthState()`. Guard against mid-session CLI removal: if `probeAuthState()` throws,
run `isInstalled()` as a triage step. If the CLI is gone, return `copilot_missing`
(triggering the correct install gate). If the CLI is still present, return an error with
the probe's original message.

**Acceptance criteria**:
- `refreshAuthState()` calls `probeAuthState()` directly rather than going through
  `getStartupState()`.
- If `probeAuthState()` throws and `isInstalled()` returns `false`, the method returns
  `copilot_missing`.
- If `probeAuthState()` throws and `isInstalled()` returns `true`, the method returns an
  error containing the probe's original message.
- `tests/main/startup-service.test.ts` `describe('StartupService.refreshAuthState()')`
  covers these paths and passes.
- No regressions in any existing `startup-service.test.ts` test cases.
