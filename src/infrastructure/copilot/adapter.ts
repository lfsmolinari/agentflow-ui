import * as fs from 'node:fs/promises';
import { realpathSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AuthProbeResult } from '@shared/startup-state';
import type { Session, ChatMessage } from '@shared/workspace-types';
import { createCommandRunner, type CommandRunner, type CommandResult } from '../system/command-runner';
import { createInteractiveCommandRunner, type InteractiveCommandRunner } from '../system/interactive-command-runner';
import { CopilotClient } from '@github/copilot-sdk';

/**
 * Copilot CLI session storage (confirmed from official documentation):
 *
 * Path:    ~/.copilot/session-state/<session-id>/events.jsonl
 * Windows: %COPILOT_HOME%\session-state\<session-id>\events.jsonl
 *          (COPILOT_HOME env var, defaults to %USERPROFILE%\.copilot)
 *
 * Format:  JSONL — one JSON object per line per event
 * Key fields per record:
 *   - sessionId: string
 *   - timestamp: number (ms since epoch)
 *   - cwd: string (working directory when session started)
 *   - source: "startup" | "resume" | "new"
 *
 * Title derivation: look for a rename event; fall back to formatted timestamp.
 *
 * If the directory does not exist at runtime, listSessions returns [].
 *
 * Source: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
 */

/**
 * Copilot CLI chat invocation (confirmed from official documentation):
 *
 * New session:    spawn `copilot --agent=strategist` with process cwd = workspace folder path
 *                 The CLI records cwd in session metadata automatically.
 *
 * Resume session: spawn `copilot --resume=<session-id>` with cwd = workspace folder path
 *
 * Invocation mode: Option B (interactive stdin/stdout) is required for streaming multi-turn chat.
 *   - Single-turn mode (`copilot -p "PROMPT"`) exits after one response and cannot stream.
 *   - Interactive mode keeps the process alive, reads stdin, and streams stdout.
 *
 * Response streaming: chunks arrive on stdout. End of response is signalled by the process
 * returning to the input prompt (implementation must track this via output patterns or process state).
 *
 * Source: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
 */

// Prompt pattern: emitted by the Copilot CLI when it is ready for the next message.
// Matches a prompt character (> or ?) at the end of buffered output, optionally preceded
// by up to 200 characters on the same line. ANSI codes are stripped before matching.
const PROMPT_PATTERN = /(?:^|\r?\n)[\s\S]{0,200}[>?]\s*$/m;
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const IDLE_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_MS = 120_000;
const READY_TIMEOUT_MS = 8_000;
const POST_READY_DELAY_MS = 50;

const authenticatedPattern = /authenticated|logged in|already logged in/i;
const unauthenticatedPattern = /not logged in|login required|unauthenticated/i;

function normalizePath(p: string): string {
  try { return realpathSync(p); } catch { return path.resolve(p); }
}

const defaultRunner = createCommandRunner();

interface ResponseState {
  onData: (chunk: string) => void;
  resolve: () => void;
  reject: (err: Error) => void;
  settle: () => void;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  maxTimer: ReturnType<typeof setTimeout> | undefined;
  buffer: string;
  hasContent: boolean;
}

interface SessionEntry {
  runner: InteractiveCommandRunner;
  workspacePath: string;
  isReady: boolean;
  pendingReady: Array<() => void>;
  responseState: ResponseState | null;
}

const parseAuthStatus = (result: CommandResult): AuthProbeResult => {
  const combined = `${result.stdout}\n${result.stderr}`.trim();

  // Try JSON first — the CLI responds with structured output when --json is passed
  try {
    const parsed = JSON.parse(result.stdout.trim());

    // Explicit boolean field (hypothetical future format)
    if (typeof parsed.authenticated === 'boolean') {
      return parsed.authenticated
        ? { authenticated: true }
        : { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
    }

    // Explicit unauthenticated status
    if (
      parsed.status === 'unauthenticated' ||
      parsed.status === 'not_logged_in' ||
      parsed.error
    ) {
      return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
    }

    // Any valid JSON response on exit 0 means authenticated
    // (copilot auth status --json only returns structured data when auth is present)
    if (result.exitCode === 0) {
      return { authenticated: true };
    }

    // Valid JSON but non-zero exit — unauthenticated
    return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
  } catch {
    // Not JSON — fall through to text parsing
  }

  // Text-based fallback
  if (result.exitCode === 0 && authenticatedPattern.test(combined) && !unauthenticatedPattern.test(combined)) {
    return { authenticated: true };
  }

  if (unauthenticatedPattern.test(combined)) {
    return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
  }

  if (result.exitCode === 0) {
    // Exit 0 with unrecognised text output — optimistically treat as authenticated
    return { authenticated: true };
  }

  // Non-zero exit with unrecognized output — treat as unauthenticated rather than throwing.
  // An exit 1 always means "not authenticated" in the auth status context; throwing here
  // causes StartupService.runLogin to return startupState('error') instead of 'unauthenticated'.
  console.warn(`[CopilotCliAdapter] parseAuthStatus: unrecognized output (exit ${result.exitCode}), treating as unauthenticated`);
  return { authenticated: false, reason: 'Copilot CLI reported an unauthenticated state.' };
};

function findCopilotBinary(): string | undefined {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const pathDirs = (process.env.PATH ?? '').split(delimiter);

  // GUI apps launched from Dock/Finder get a truncated PATH that omits Homebrew
  // and version manager bin dirs. Append common install locations as fallback.
  const fallbackDirs =
    process.platform !== 'win32'
      ? [
          '/opt/homebrew/bin', // Homebrew on Apple Silicon macOS
          '/usr/local/bin', // Homebrew on Intel macOS / manual installs
          `${os.homedir()}/.local/bin`, // Linux user-local installs
          '/usr/bin',
        ]
      : [];

  const seen = new Set<string>();
  for (const dir of [...pathDirs, ...fallbackDirs]) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const candidate = path.join(dir, `copilot${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export class CopilotCliAdapter {
  constructor(
    private readonly runner: CommandRunner = defaultRunner,
    private readonly runnerFactory: typeof createInteractiveCommandRunner = createInteractiveCommandRunner
  ) {}

  private readonly activeSessions = new Map<string, SessionEntry>();

  private stripAnsi(text: string): string {
    return text.replace(ANSI_ESCAPE_RE, '');
  }

  private hasPrompt(buffer: string): boolean {
    return PROMPT_PATTERN.test(this.stripAnsi(buffer));
  }

  private waitForReady(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      const entry = this.activeSessions.get(sessionId);
      if (!entry || entry.isReady) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        console.warn(
          `[CopilotCliAdapter] waitForReady: prompt not detected within ${READY_TIMEOUT_MS}ms ` +
          `for session ${sessionId} — proceeding anyway`
        );
        resolve();
      }, READY_TIMEOUT_MS);
      entry.pendingReady.push(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  closeSession(sessionId: string): void {
    const entry = this.activeSessions.get(sessionId);
    if (!entry) return;
    entry.runner.close();
    this.activeSessions.delete(sessionId);
  }

  closeAll(): void {
    for (const id of [...this.activeSessions.keys()]) {
      this.closeSession(id);
    }
  }

  async isInstalled(): Promise<boolean> {
    try {
      const result = await this.runner.run('copilot', ['--version']);
      if (result.exitCode !== 0) return false;
      const combined = `${result.stdout}\n${result.stderr}`;
      // VS Code ships a shim that outputs this when the real CLI is missing
      if (combined.includes('Cannot find GitHub Copilot CLI')) return false;
      return true;
    } catch {
      return false;
    }
  }

  async probeAuthState(): Promise<AuthProbeResult> {
    // Use the SDK to probe auth state — the CLI's `auth status` command is unreliable
    // across CLI versions (exits 1 even when authenticated). The SDK uses the same
    // underlying credentials; if listSessions() succeeds, the user is authenticated.
    let client: CopilotClient | null = null;
    try {
      const cliPath = findCopilotBinary();
      client = new CopilotClient({ autoStart: true, ...(cliPath !== undefined ? { cliPath } : {}) });
      await client.listSessions();
      return { authenticated: true };
    } catch {
      return { authenticated: false, reason: 'Copilot CLI is not authenticated. Please run copilot login.' };
    } finally {
      client?.stop().catch(() => {});
    }
  }

  async loginWithGitHub(onData?: (chunk: string) => void): Promise<void> {
    const result = await this.runner.run('copilot', ['login'], 5 * 60 * 1000, onData);

    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] loginWithGitHub failed (exit ${result.exitCode})`);
      throw new Error('GitHub login did not complete successfully.');
    }
  }

  async loginWithEnterprise(host: string, onData?: (chunk: string) => void): Promise<void> {
    const result = await this.runner.run('copilot', ['login', '--host', host], 5 * 60 * 1000, onData);

    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] loginWithEnterprise failed (exit ${result.exitCode})`);
      throw new Error('GitHub Enterprise login did not complete successfully.');
    }
  }

  async logout(): Promise<void> {
    const result = await this.runner.run('copilot', ['logout']);
    if (result.exitCode !== 0) {
      console.error(`[CopilotCliAdapter] logout failed (exit ${result.exitCode})`);
      throw new Error('Logout failed. Please try again.');
    }
  }

  async listSessions(workspacePath: string): Promise<Session[]> {
    // Resolve the base sessions directory
    const homeDir = process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot');
    const sessionsDir = path.join(homeDir, 'session-state');

    let sessionDirs: string[];
    try {
      const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
      sessionDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }

    const normalizedWorkspacePath = normalizePath(workspacePath);
    const sessions: Session[] = [];
    for (const sessionId of sessionDirs) {
      const eventsPath = path.join(sessionsDir, sessionId, 'events.jsonl');
      try {
        const raw = await fs.readFile(eventsPath, 'utf-8');
        const lines = raw.trim().split('\n').filter(Boolean);
        const events = lines.map(l => JSON.parse(l));

        // Filter by workspace path
        const cwdMatch = events.some(
          (e: Record<string, unknown>) =>
            typeof e.cwd === 'string' && normalizePath(e.cwd) === normalizedWorkspacePath
        );
        if (!cwdMatch) continue;

        // Title derivation
        const renameEvent = events.find(
          (e: Record<string, unknown>) => e.type === 'rename' && typeof e.name === 'string'
        );
        const firstTimestamp = events.find(
          (e: Record<string, unknown>) => typeof e.timestamp === 'number'
        );
        const title = renameEvent
          ? (renameEvent.name as string)
          : firstTimestamp
          ? new Date(firstTimestamp.timestamp as number).toLocaleString()
          : 'Session';

        const createdAt = firstTimestamp
          ? new Date(firstTimestamp.timestamp as number).toISOString()
          : undefined;

        sessions.push({ id: sessionId, title, workspacePath, createdAt });
      } catch {
        // Skip unreadable session directories
        continue;
      }
    }

    // Sort by createdAt descending (most recent first)
    return sessions.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async startNewSession(workspacePath: string): Promise<Session> {
    const homeDir = process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot');
    const sessionsDir = path.join(homeDir, 'session-state');

    const before = await fs.readdir(sessionsDir).catch(() => [] as string[]);

    const entry: SessionEntry = {
      runner: undefined!,
      workspacePath,
      isReady: false,
      pendingReady: [],
      responseState: null
    };

    const sessionIdRef = { value: undefined as string | undefined };
    let startupDone = false;
    let startupBuffer = '';
    let startupIdleTimer: ReturnType<typeof setTimeout> | undefined;

    const onData = (chunk: string): void => {
      // [DIAGNOSTIC] TODO: remove before merge
      console.log('[COPILOT_RAW] chunk:', JSON.stringify(chunk), 'startupDone:', startupDone, 'hasResponseState:', entry.responseState !== null);

      // Drain startup content first — startup takes priority over responseState.
      // Prevents lingering startup output from being misinterpreted as a response.
      if (!startupDone) {
        startupBuffer += chunk;
        clearTimeout(startupIdleTimer);
        const markReady = (): void => {
          if (startupDone) return;
          startupDone = true;
          entry.isReady = true;
          const callbacks = entry.pendingReady.splice(0);
          for (const cb of callbacks) cb();
        };
        if (this.hasPrompt(startupBuffer)) {
          markReady();
        } else {
          startupIdleTimer = setTimeout(markReady, IDLE_TIMEOUT_MS);
        }
        return;
      }

      if (entry.responseState !== null) {
        const rs = entry.responseState;
        rs.buffer += chunk;
        if (chunk.length > 0) rs.hasContent = true;
        rs.onData(chunk);
        if (this.hasPrompt(rs.buffer)) {
          rs.settle();
        } else if (rs.hasContent) {
          clearTimeout(rs.idleTimer);
          rs.idleTimer = setTimeout(rs.settle, IDLE_TIMEOUT_MS);
        }
      }
    };

    const onExit = (code: number | null): void => {
      clearTimeout(startupIdleTimer);
      if (code !== null && code !== 0) {
        console.error(`[CopilotCliAdapter] copilot process exited with code ${code}`);
      }
      if (entry.responseState !== null) {
        const rs = entry.responseState;
        clearTimeout(rs.idleTimer);
        clearTimeout(rs.maxTimer);
        entry.responseState = null;
        rs.reject(new Error(`copilot process exited unexpectedly (code ${code})`));
      }
      if (sessionIdRef.value !== undefined) {
        this.activeSessions.delete(sessionIdRef.value);
      }
    };

    entry.runner = this.runnerFactory('copilot', ['--agent=strategist'], workspacePath, onData, onExit);

    // Poll for up to 10 seconds (20 attempts × 500ms)
    let newId: string | undefined;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const after = await fs.readdir(sessionsDir).catch(() => [] as string[]);
      const diff = after.filter(d => !before.includes(d));
      if (diff.length > 0) {
        newId = diff[0];
        break;
      }
    }

    if (!newId) {
      entry.runner.close();
      throw new Error('Copilot CLI did not create a session directory within 10 seconds. Ensure the CLI is installed and authenticated.');
    }

    sessionIdRef.value = newId;
    this.activeSessions.set(newId, entry);

    await this.waitForReady(newId);

    return {
      id: newId,
      title: new Date().toLocaleString(),
      workspacePath,
      createdAt: new Date().toISOString()
    };
  }

  async openSession(sessionId: string): Promise<ChatMessage[]> {
    const homeDir = process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot');
    const sessionsDir = path.join(homeDir, 'session-state');
    const eventsPath = path.resolve(path.join(sessionsDir, sessionId, 'events.jsonl'));
    if (!eventsPath.startsWith(sessionsDir + path.sep)) {
      throw new Error('Invalid session ID');
    }

    try {
      const raw = await fs.readFile(eventsPath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      const events = lines.map(l => JSON.parse(l));

      const messages: ChatMessage[] = [];
      for (const event of events) {
        if (event.type === 'userMessage' && typeof event.content === 'string') {
          messages.push({ role: 'user', content: event.content });
        } else if (event.type === 'assistantMessage' && typeof event.content === 'string') {
          messages.push({ role: 'assistant', content: event.content });
        }
      }
      return messages;
    } catch {
      return [];
    }
  }

  private async _resolveSessionCwd(sessionId: string): Promise<string> {
    const homeDir = process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot');
    const eventsPath = path.join(homeDir, 'session-state', sessionId, 'events.jsonl');
    try {
      const raw = await fs.readFile(eventsPath, 'utf-8');
      const firstLine = raw.split('\n').find((l) => l.trim());
      if (firstLine) {
        const event = JSON.parse(firstLine) as Record<string, unknown>;
        if (typeof event.cwd === 'string') return event.cwd;
      }
    } catch {
      // ignore — return fallback
    }
    return os.homedir();
  }

  async sendMessage(
    sessionId: string,
    text: string,
    onData: (chunk: string) => void
  ): Promise<void> {
    if (!this.activeSessions.has(sessionId)) {
      const cwd = await this._resolveSessionCwd(sessionId);

      const lazyEntry: SessionEntry = {
        runner: undefined!,
        workspacePath: cwd,
        isReady: false,
        pendingReady: [],
        responseState: null
      };

      let lazyStartupDone = false;
      let lazyStartupBuffer = '';

      const lazyOnData = (chunk: string): void => {
        // [DIAGNOSTIC] TODO: remove before merge
        console.log('[COPILOT_LAZY_RAW] chunk:', JSON.stringify(chunk), 'startupDone:', lazyStartupDone, 'hasResponseState:', lazyEntry.responseState !== null);

        // Drain startup content first — startup takes priority over responseState.
        if (!lazyStartupDone) {
          lazyStartupBuffer += chunk;
          if (this.hasPrompt(lazyStartupBuffer)) {
            lazyStartupDone = true;
            lazyEntry.isReady = true;
            const callbacks = lazyEntry.pendingReady.splice(0);
            for (const cb of callbacks) cb();
          }
          return;
        }

        if (lazyEntry.responseState !== null) {
          const rs = lazyEntry.responseState;
          rs.buffer += chunk;
          if (chunk.length > 0) rs.hasContent = true;
          rs.onData(chunk);
          if (this.hasPrompt(rs.buffer)) {
            rs.settle();
          } else if (rs.hasContent) {
            clearTimeout(rs.idleTimer);
            rs.idleTimer = setTimeout(rs.settle, IDLE_TIMEOUT_MS);
          }
        }
      };

      const lazyOnExit = (code: number | null): void => {
        if (code !== null && code !== 0) {
          console.error(`[CopilotCliAdapter] session ${sessionId} exited with code ${code}`);
        }
        if (lazyEntry.responseState !== null) {
          const rs = lazyEntry.responseState;
          clearTimeout(rs.idleTimer);
          clearTimeout(rs.maxTimer);
          lazyEntry.responseState = null;
          rs.reject(new Error(`copilot process exited unexpectedly (code ${code})`));
        }
        this.activeSessions.delete(sessionId);
      };

      lazyEntry.runner = this.runnerFactory('copilot', ['--resume', sessionId], cwd, lazyOnData, lazyOnExit);
      this.activeSessions.set(sessionId, lazyEntry);
      await this.waitForReady(sessionId);
      await new Promise<void>(r => setTimeout(r, POST_READY_DELAY_MS));
    }

    const entry = this.activeSessions.get(sessionId);
    if (!entry) {
      throw new Error(`Session ${sessionId} is no longer available`);
    }

    if (entry.responseState !== null) {
      throw new Error('Session is busy — a previous message is still in flight');
    }

    const callerOnData = onData;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const state: ResponseState = {
        onData: callerOnData,
        resolve,
        reject,
        settle: () => { /* replaced below before first use */ },
        idleTimer: undefined,
        maxTimer: undefined,
        buffer: '',
        hasContent: false
      };

      state.settle = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(state.idleTimer);
        clearTimeout(state.maxTimer);
        entry.responseState = null;
        resolve();
      };

      entry.responseState = state;
      try {
        entry.runner.write(text);
      } catch (writeErr) {
        entry.responseState = null;
        reject(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
        return;
      }
      state.maxTimer = setTimeout(state.settle, MAX_RESPONSE_MS);
    });
  }
}

export { parseAuthStatus };
