import * as fs from 'node:fs/promises';
import { realpathSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CopilotClient, approveAll } from '@github/copilot-sdk';
import type { CopilotSession, SessionMetadata, SessionEvent } from '@github/copilot-sdk';
import type { ChatProvider } from '@infra/chat/provider';
import type { Session, ChatMessage } from '@shared/workspace-types';

// Strategist agent persona — extracted from .github/agents/strategist.agent.md
const STRATEGIST_PROMPT = `You are a strategic product thinking companion.

Your role is to help tech leads, developers, and Product Owners think through ideas, challenge assumptions, and turn product thinking into structured epics. You operate before specs, before plans, before code.

Your primary artifact is \`specs/{epic-name}/product-requirements.md\` — an epic-level document written for humans (POs, leads) that can be used to derive Jira user stories and feeds the Architect when it generates a technical spec. This is the only file that lives in the epic folder. Feature specs, plans, and tasks live in their own separate folders.

You do NOT write code and you do NOT default to implementation planning unless explicitly asked.

## Your Job

- Expand the problem space — do not converge to a final solution
- Brainstorm possible approaches (2–4 options max)
- Compare trade-offs honestly
- Challenge assumptions and surface hidden constraints
- Identify risks and unknowns early
- Help refine vague or early-stage ideas into a structured product requirement
- Identify what still needs to be decided before a spec can be written
- Write product-requirements.md when the exploration has reached a conclusion

## How to Behave

- Prefer exploration before convergence.
- Ask clarifying questions when they will improve the thinking.
- Propose multiple options when the problem is ambiguous.
- Be comfortable leaving questions open when the right answer is not clear yet.
- Avoid turning every discussion into an execution plan.
- When the idea is mature enough, suggest the user move to the Architect agent for formal specification.

## Preferred Output Style

- Conversational and concise.
- Use structured bullets only when they improve clarity.
- Organize your output as: Problem framing, Key unknowns, Options (2–4), Trade-offs, Open questions, Recommendation (optional).`;

function normalizePath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function sidecarPath(sessionId: string): string {
  const homeDir = process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot');
  return path.join(homeDir, 'session-state', sessionId, '.agentflow-meta.json');
}

function findCopilotBinary(): string | undefined {
  // Resolve the system `copilot` binary from PATH.
  // The SDK defaults to its bundled @github/copilot/index.js (a .js file), which it
  // spawns via process.execPath (= Electron binary = Node 20.x). node:sqlite requires
  // Node 22.5+, so the bundled path fails inside Electron. Pointing to the system shell
  // script lets the OS use its shebang (#!/usr/bin/env node) → system Node 22+ → works.
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

interface SidecarData {
  workspacePath: string;
  createdAt: string;
}

export class CopilotSdkProvider implements ChatProvider {
  private _client: CopilotClient | null = null;
  private readonly activeSessions = new Map<string, CopilotSession>();

  private get client(): CopilotClient {
    if (!this._client) {
      const cliPath = findCopilotBinary();
      this._client = new CopilotClient({ autoStart: true, ...(cliPath !== undefined ? { cliPath } : {}) });
    }
    return this._client;
  }

  async listSessions(workspacePath: string): Promise<Session[]> {
    const normalizedPath = normalizePath(workspacePath);
    let allSessions: SessionMetadata[];
    try {
      allSessions = await this.client.listSessions();
    } catch {
      return [];
    }

    const results: Session[] = [];
    for (const meta of allSessions) {
      try {
        const raw = await fs.readFile(sidecarPath(meta.sessionId), 'utf-8');
        const sidecar = JSON.parse(raw) as SidecarData;
        if (normalizePath(sidecar.workspacePath) !== normalizedPath) continue;
        results.push({
          id: meta.sessionId,
          title: meta.summary ?? new Date(meta.startTime).toLocaleString(),
          workspacePath: sidecar.workspacePath,
          createdAt: sidecar.createdAt,
        });
      } catch {
        // No sidecar — session created outside the app; skip it
      }
    }

    return results.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }

  async startNewSession(workspacePath: string): Promise<Session> {
    const session = await this.client.createSession({
      streaming: true,
      model: 'gpt-4.1',
      systemMessage: {
        mode: 'replace',
        content: `Working directory: ${workspacePath}\n\n${STRATEGIST_PROMPT}`,
      },
      onPermissionRequest: approveAll,
    });

    this.activeSessions.set(session.sessionId, session);

    const createdAt = new Date().toISOString();
    const sidecar: SidecarData = { workspacePath, createdAt };
    try {
      const sidecarFile = sidecarPath(session.sessionId);
      await fs.mkdir(path.dirname(sidecarFile), { recursive: true });
      await fs.writeFile(sidecarFile, JSON.stringify(sidecar), 'utf-8');
    } catch (err) {
      console.error('[CopilotSdkProvider] Failed to write session sidecar:', err);
    }

    return {
      id: session.sessionId,
      title: new Date(createdAt).toLocaleString(),
      workspacePath,
      createdAt,
    };
  }

  async openSession(sessionId: string): Promise<ChatMessage[]> {
    try {
      let session = this.activeSessions.get(sessionId);
      if (!session) {
        session = await this.client.resumeSession(sessionId, { onPermissionRequest: approveAll });
        this.activeSessions.set(sessionId, session);
      }

      const events: SessionEvent[] = await session.getMessages();
      const messages: ChatMessage[] = [];
      for (const event of events) {
        if (event.type === 'user.message') {
          messages.push({ role: 'user', content: (event as unknown as { type: string; content: string }).content });
        } else if (event.type === 'assistant.message') {
          messages.push({ role: 'assistant', content: (event as unknown as { type: string; content: string }).content });
        }
      }
      return messages;
    } catch {
      return [];
    }
  }

  async sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void> {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = await this.client.resumeSession(sessionId, { onPermissionRequest: approveAll });
      this.activeSessions.set(sessionId, session);
    }

    const unsub = session.on('assistant.message_delta', (e: { data: { deltaContent: string } }) => {
      onData(e.data.deltaContent);
    });

    try {
      await session.sendAndWait({ prompt: text }, 120_000);
    } finally {
      unsub();
    }
  }

  closeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.disconnect().catch((err: unknown) => {
        console.error('[CopilotSdkProvider] Error disconnecting session:', err);
      });
      this.activeSessions.delete(sessionId);
    }
  }

  closeAll(): void {
    this.activeSessions.clear();
    if (this._client) {
      this._client.stop().catch((err: unknown) => {
        console.error('[CopilotSdkProvider] Error stopping client:', err);
      });
      this._client = null;
    }
  }
}
