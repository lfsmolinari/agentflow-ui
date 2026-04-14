# Spec: Windows Copilot CLI Detection Fix

## Status

- **Created**: 2026-04-14
- **Status**: Implemented
- **Author**: Architect
- **Scope**: `command-runner.ts` env configuration only

---

## Summary

Copilot CLI detection (`copilot --version`) fails on Windows even when the CLI is
installed. The app shows the "Copilot CLI required" install gate instead of the login
screen. The failure is in `src/infrastructure/system/command-runner.ts`: a hand-rolled
environment whitelist strips `PATHEXT` (and other Windows-critical variables) before
spawning the child process, causing `cmd.exe` to be unable to resolve `copilot.cmd` by
bare name.

---

## Problem Statement

`CopilotCliAdapter.isInstalled()` runs `copilot --version` via `CommandRunner.run()`.
When `run()` spawns the process with `shell: true` and a custom `env` object that omits
`PATHEXT`, `cmd.exe` cannot resolve the bare name `copilot` to the `copilot.cmd` shim on
disk, even when its directory is correctly on `PATH`. The process exits non-zero (or
throws), `isInstalled()` returns `false`, and the app walls the user behind the install
gate.

Two prior fixes addressed symptoms (adding `shell: true`, augmenting PATH with npm
directories) but not the structural cause.

---

## Root Causes

### RC1 — `PATHEXT` absent from the whitelist (primary, definitive)

`PATHEXT` is the Windows environment variable that tells `cmd.exe` which file extensions
constitute an executable when resolving a bare command name. Its typical value is
`.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC`.

The GitHub Copilot CLI, whether installed via npm, Scoop, or Volta, is exposed as a
`.cmd` shim (`copilot.cmd`). When `cmd.exe` runs with no `PATHEXT` in its env, it falls
back to an internal default. On standard Windows 10/11 that default includes `.CMD`, but
on locked-down or corporate-managed images it may be restricted to `.COM;.EXE` only.
In either case, relying on the fallback is incorrect; the env should supply `PATHEXT`
explicitly.

The current whitelist does not include `PATHEXT`. It also omits `SystemRoot`, `windir`,
and `COMSPEC` — all of which can affect `cmd.exe` compatibility on certain Windows
configurations.

### RC2 — PATH from Electron GUI launch may be incomplete (secondary)

When Electron is launched via the compiled binary (not from a terminal), `process.env.PATH`
reflects the Windows registry PATH: machine-level (`HKLM`) merged with user-level
(`HKCU\Environment`). Tools installed by Scoop (`%USERPROFILE%\scoop\shims`), Volta
(`%USERPROFILE%\.volta\bin`), fnm, or winget-managed packages typically add their
directories to PATH, but only in terminal sessions that read shell profiles. The current
augmentation covers `%APPDATA%\npm` and `%LOCALAPPDATA%\npm` but no other install
managers.

### RC3 — The whitelist approach is structurally unsound (root cause of RC1 and RC2)

Both defects are consequences of a single architectural choice: rebuilding a custom env
by whitelisting specific variable names, then augmenting it. Any variable omitted from the
whitelist silently corrupts the child process environment. The whitelist provides no
security benefit in a local desktop app (the commands executed are the user's own installed
tools; there is no untrusted input), but it actively prevents reliable cross-platform
subprocess execution.

---

## Goals

1. `copilot --version` reliably succeeds on Windows when the CLI is installed, regardless
   of which package manager was used to install it.
2. No regression on macOS or Linux.
3. The fix is minimal — it should not introduce new dependencies, abstractions, or
   complexity.

---

## Non-Goals

- Detecting Copilot CLI installations that exist only inside WSL environments.
- Addressing PATH incompleteness for GUI-launched Electron apps (this is a Windows
  platform limitation shared by all native apps; it is out of scope here).
- Changing any other part of the startup flow — with the exception of the T6 addendum (see tasks.md T6): `refreshAuthState()` was optimized post-spec to skip `isInstalled()` on post-login auth refresh, reducing latency. The core detection fix scope remains `command-runner.ts` only.

---

## Acceptance Criteria

- **Given** Copilot CLI is installed on a Windows machine (via npm, Scoop, Volta, or any
  method that adds an entry to the user's PATH), **when** the compiled Electron app
  starts, **then** the app shows the login screen (`"Sign in to continue"`), not the
  install gate (`"Copilot CLI required"`).
- **Given** Copilot CLI is not installed, **when** the app starts, **then** the install
  gate is shown as before.
- **Given** the app runs on macOS or Linux, **when** the app starts, **then** existing
  behavior is unchanged.
- The e2e test `'shows login screen when Copilot CLI is installed'` in
  `tests/e2e/startup.e2e.ts` passes.

---

## Assumptions

- The Electron main process inherits a `process.env` that includes `PATHEXT` and a
  sufficiently complete `PATH` for tools that were properly installed on the host (i.e.
  added to the Windows registry PATH, not solely via shell profile).
- The test machine used for `npm run test:e2e` has Copilot CLI installed at a location
  that is on the system/user registry PATH.
