import type { Session, ChatMessage } from '@shared/workspace-types';

export interface ChatProvider {
  listSessions(workspacePath: string): Promise<Session[]>;
  startNewSession(workspacePath: string): Promise<Session>;
  openSession(sessionId: string): Promise<ChatMessage[]>;
  sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void>;
  closeSession(sessionId: string): void;
  closeAll(): void;
}
