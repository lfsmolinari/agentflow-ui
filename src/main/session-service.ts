import type { Session } from '@shared/workspace-types';
import type { ChatProvider } from '@infra/chat/provider';

export class SessionService {
  constructor(private readonly provider: ChatProvider) {}

  async listSessions(workspacePath: string): Promise<Session[]> {
    try {
      return await this.provider.listSessions(workspacePath);
    } catch {
      return [];
    }
  }
}
