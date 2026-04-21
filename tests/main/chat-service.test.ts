import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '@main/chat-service';
import type { ChatProvider } from '@infra/chat/provider';
import type { Session, ChatMessage } from '@shared/workspace-types';

const makeProvider = (): ChatProvider => ({
  listSessions: vi.fn(),
  startNewSession: vi.fn(),
  openSession: vi.fn(),
  sendMessage: vi.fn(),
  closeSession: vi.fn(),
  closeAll: vi.fn(),
});

describe('ChatService', () => {
  let provider: ChatProvider;
  let service: ChatService;

  beforeEach(() => {
    provider = makeProvider();
    service = new ChatService(provider);
  });

  it('delegates startNewSession to provider', async () => {
    const session: Session = { id: 'abc', title: 'Test', workspacePath: '/ws' };
    vi.mocked(provider.startNewSession).mockResolvedValue(session);

    const result = await service.startNewSession('/ws');
    expect(provider.startNewSession).toHaveBeenCalledWith('/ws');
    expect(result).toEqual(session);
  });

  it('delegates openSession to provider', async () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    vi.mocked(provider.openSession).mockResolvedValue(messages);

    const result = await service.openSession('abc');
    expect(provider.openSession).toHaveBeenCalledWith('abc');
    expect(result).toEqual(messages);
  });

  it('delegates sendMessage to provider', async () => {
    vi.mocked(provider.sendMessage).mockResolvedValue(undefined);
    const onData = vi.fn();

    await service.sendMessage('abc', 'hello', onData);
    expect(provider.sendMessage).toHaveBeenCalledWith('abc', 'hello', onData);
  });

  it('delegates closeSession to provider', () => {
    service.closeSession('abc');
    expect(provider.closeSession).toHaveBeenCalledWith('abc');
  });

  it('delegates closeAll to provider', () => {
    service.closeAll();
    expect(provider.closeAll).toHaveBeenCalled();
  });
});
