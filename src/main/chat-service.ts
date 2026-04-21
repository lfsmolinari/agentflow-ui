import type { Session, ChatMessage } from '@shared/workspace-types';
import type { ChatProvider } from '@infra/chat/provider';

export class ChatService {
  constructor(private readonly provider: ChatProvider) {}

  startNewSession(workspacePath: string): Promise<Session> {
    return this.provider.startNewSession(workspacePath);
  }

  openSession(sessionId: string): Promise<ChatMessage[]> {
    return this.provider.openSession(sessionId);
  }

  sendMessage(sessionId: string, text: string, onData: (chunk: string) => void): Promise<void> {
    return this.provider.sendMessage(sessionId, text, onData);
  }

  closeSession(sessionId: string): void {
    this.provider.closeSession(sessionId);
  }

  closeAll(): void {
    this.provider.closeAll();
  }
}
