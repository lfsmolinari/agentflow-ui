import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '@main/session-service';
import type { ChatProvider } from '@infra/chat/provider';
import type { Session } from '@shared/workspace-types';

const makeProvider = (): ChatProvider => ({
  listSessions: vi.fn(),
  startNewSession: vi.fn(),
  openSession: vi.fn(),
  sendMessage: vi.fn(),
  closeSession: vi.fn(),
  closeAll: vi.fn(),
});

describe('SessionService', () => {
  let provider: ChatProvider;
  let service: SessionService;

  beforeEach(() => {
    provider = makeProvider();
    service = new SessionService(provider);
  });

  it('delegates listSessions to provider', async () => {
    const sessions: Session[] = [
      { id: 'abc', title: 'Session 1', workspacePath: '/ws' },
    ];
    vi.mocked(provider.listSessions).mockResolvedValue(sessions);

    const result = await service.listSessions('/ws');
    expect(provider.listSessions).toHaveBeenCalledWith('/ws');
    expect(result).toEqual(sessions);
  });

  it('returns empty array when provider.listSessions throws', async () => {
    vi.mocked(provider.listSessions).mockRejectedValue(new Error('SDK error'));

    const result = await service.listSessions('/ws');
    expect(result).toEqual([]);
  });
});
