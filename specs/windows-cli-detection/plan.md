# Implementation Plan: Windows Copilot CLI Detection Fix

## Status

- **Created**: 2026-04-14
- **Status**: Implemented
- **Author**: Architect
- **Spec**: `specs/windows-cli-detection/spec.md`
- **Scope**: `command-runner.ts` env configuration — single-file fix with supporting validation

---

## Goal

Make `copilot --version` reliably succeed on Windows when the Copilot CLI is installed,
without regression on macOS or Linux. The fix is intentionally minimal.

---

## Root Cause Confirmed

The env whitelist in `createCommandRunner()` rebuilds the child process environment from a
hand-selected set of variable names. The whitelist omits `PATHEXT`, `SystemRoot`, `windir`,
and `COMSPEC` — all of which `cmd.exe` may require on Windows to resolve bare command names
to `.cmd` shims.

`shell: process.platform === 'win32'` was a correct partial fix: it routes execution
through `cmd.exe`. But passing a stripped env to `cmd.exe` means the shell either falls
back to a restricted internal default for `PATHEXT` (which may exclude `.CMD` on managed
images) or fails to locate system internals entirely.

**The command name `copilot` is correct.** The official GitHub Copilot CLI install methods
(`npm install -g @github/copilot`, `winget install GitHub.Copilot`,
`brew install copilot-cli`) all produce a standalone `copilot` binary/shim. The `gh
copilot` extension is a separate product unrelated to this app. No command fallback is
needed and `adapter.ts` requires no changes.

---

## Architectural Decision

Replace the whitelist approach in `createCommandRunner()` with `{ ...process.env }`.

Rationale:

- The whitelist provides no security benefit. The commands executed are the user's own
  installed tools; no untrusted input flows into `command`. Env filtering is not a
  meaningful security control here.
- Passing `process.env` directly ensures the child process inherits the same environment
  the Electron main process received from the OS — including `PATHEXT`, `SystemRoot`,
  `windir`, `COMSPEC`, and the complete `PATH` as read from the Windows registry at
  launch time.
- All existing Windows PATH gaps (WinGet, Scoop, Volta, fnm, direct downloads) are
  resolved automatically because registry-managed PATH entries are already present in
  `process.env.PATH` when Electron starts. Explicit PATH augmentation becomes
  unnecessary and can be removed.
- macOS and Linux are unaffected: their PATH and env handling do not differ between
  whitelist and full passthrough on a developer or CI machine.

---

## In Scope

- `src/infrastructure/system/command-runner.ts` — env construction
- `tests/infrastructure/command-runner.test.ts` — one new env passthrough test
- `tests/infrastructure/copilot/adapter.test.ts` — one missing edge case test
- `tests/e2e/startup.e2e.ts` — update stale error message text

## Out of Scope

- Changes to `adapter.ts` command logic (`copilot` is the correct name; no further
  modifications are warranted)
- Startup-state resolution logic (`startup-service.ts`) — _T6 addendum_: `refreshAuthState()` was optimized post-plan; see tasks.md T6 for rationale and scope. This was the only exception to this boundary.
- UI or install gate components
- WSL-resident CLI installations
- Any PATH augmentation for package managers not covered by registry PATH — this is
  a platform-level concern and outside the app's control

---

## Phase Plan

### Phase 1: Fix `command-runner.ts`

**Objective**: Eliminate the whitelist and pass the full host environment to every
spawned child process.

**Steps**:

1. Remove the destructured whitelist variables (`PATH`, `HOME`, `USERPROFILE`, etc.)
   and the `Object.fromEntries` construction block.
2. Replace the whitelist-built `env` with `const env = { ...process.env }`.
3. Remove the Windows-specific PATH augmentation block (the `if
   (process.platform === 'win32')` block that appends npm and NVM directories). This
   block is now superseded: `process.env.PATH` already contains the registry-managed
   PATH at Electron startup, including all entries added by any package manager.
4. Keep `shell: process.platform === 'win32'` exactly as-is — it was always correct.
5. Keep the rest of `spawn` configuration, timeout logic, and stdio handling unchanged.

**Exit criteria**:

- `createCommandRunner().run('copilot', ['--version'])` succeeds on Windows when the
  CLI is installed via npm, WinGet, or any method that adds entries to the user PATH.
- No other behavior changes.

**Impacted file**: `src/infrastructure/system/command-runner.ts`

---

### Phase 2: Verify `adapter.ts` requires no changes

**Objective**: Confirm and document that `adapter.ts` is correct as-is; avoid
unnecessary churn.

**Findings**:

- The command name `copilot` is correct for all official install methods (verified
  against `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli`).
- `isInstalled()` already handles: exit-0 success, non-zero exit (returns `false`),
  thrown exceptions (returns `false`), and the VS Code shim edge case (`'Cannot find
  GitHub Copilot CLI'` in output).
- `probeAuthState()`, `loginWithGitHub()`, `loginWithEnterprise()`, and `logout()` are
  all unaffected.

**Steps**:

1. Read `src/infrastructure/copilot/adapter.ts` and confirm no changes are needed.
2. Do not modify the file. Record this as a verified no-op.

**Exit criteria**: Adapter reviewed; no diff produced; decision documented.

---

### Phase 3: Unit test additions

**Objective**: Cover the changed behavior in `command-runner.ts` and one missing edge
case in the adapter.

#### 3a. `command-runner.ts` env passthrough test

Location: `tests/infrastructure/command-runner.test.ts`

Add one test that verifies the spawned process inherits the host's env:

- Set a known env var in `process.env` (e.g., `process.env.TEST_RUNNER_CHECK`).
- Run a command that echoes the env var (platform-appropriate: `echo %TEST_RUNNER_CHECK%`
  on Windows, `echo $TEST_RUNNER_CHECK` on Unix, or use `node -e
  "process.stdout.write(process.env.TEST_RUNNER_CHECK)"` for cross-platform).
- Assert the output contains the expected value.
- Clean up `process.env.TEST_RUNNER_CHECK` in `afterEach` or `finally`.

Note: The existing tests for `echo hello` (stdout, exitCode) and timeout behavior remain
valid and unchanged.

#### 3b. `adapter.test.ts` — missing runner-throws edge case

Location: `tests/infrastructure/copilot/adapter.test.ts`

Add one test that confirms `isInstalled()` returns `false` (rather than propagating)
when the underlying runner throws. The current `try/catch` in `isInstalled()` handles
this correctly but no test exercises it.

Test shape:

- Create a `CommandRunner` mock whose `run` method throws (e.g., `throw new Error('spawn
  ENOENT')`).
- Assert `adapter.isInstalled()` resolves to `false`.

**Exit criteria**: Both tests pass. No new test failures introduced.

---

### Phase 4: Update stale error message in `startup.e2e.ts`

**Objective**: Keep the E2E failure hint message accurate after the fix changes the
responsible code pattern.

Location: `tests/e2e/startup.e2e.ts`

The `'shows login screen when Copilot CLI is installed'` test currently includes this
assertion message:

```
Check src/infrastructure/system/command-runner.ts PATH augmentation.
```

After the fix, the root cause is env passthrough — not PATH augmentation specifically.
Update the message to:

```
Check src/infrastructure/system/command-runner.ts env configuration.
```

No other changes to the E2E test file. Both E2E test cases (`'app reaches a stable
startup state'` and `'shows login screen when Copilot CLI is installed'`) remain as-is.

**Exit criteria**: The assertion message reflects the actual fix applied.

---

### Phase 5: Validation

Run the full validation suite in order. All steps must pass.

| Step | Command | Required because |
|---|---|---|
| Typecheck | `npm run typecheck` | Always |
| Lint | `npm run lint` | Always |
| Unit / integration | `npm test` | Always |
| E2E | `npm run test:e2e` | `command-runner.ts` and its E2E trigger |

**E2E prerequisite**: The machine running `npm run test:e2e` must have Copilot CLI
installed at a location on the registry PATH (installed via npm, WinGet, Homebrew, or
install script). The second test (`'shows login screen when Copilot CLI is installed'`)
will fail on any machine where the CLI is genuinely not installed.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Some deeply locked corporate image restricts even the registry PATH | Low | Medium | This is a platform constraint outside the app's control; the spec explicitly marks it out of scope |
| Passing full env leaks a secret variable to a subprocess | Very low | Low | The subprocess is the user's own `copilot` CLI, which already runs with the same user's full env in a terminal; no new attack surface is introduced |
| The `echo` approach in the env passthrough unit test is platform-fragile | Medium | Low | Use the `node -e` form to keep it cross-platform; or skip this test on platforms where it is not deterministic |

---

## Dependency Notes

- No external dependencies are added.
- No other spec or plan files need to be updated.
- The fix is self-contained within `src/infrastructure/system/command-runner.ts`.

---

## Definition of Done

- `npm test` passes with new unit tests added.
- `npm run test:e2e` passes on the developer's Windows machine with CLI installed.
- No changes made to `adapter.ts`, `startup-service.ts`, or any renderer file.
- The stale error message in `startup.e2e.ts` is updated.
