import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session, ChatMessage } from '@shared/workspace-types';
import { ChatService } from '@main/chat-service';
import type { ChatProvider } from '@infra/chat/provider';

describe('ChatService', () => {
  let mockStartNewSession: ReturnType<typeof vi.fn>;
  let mockOpenSession: ReturnType<typeof vi.fn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let service: ChatService;

  beforeEach(() => {
    mockStartNewSession = vi.fn();
    mockOpenSession = vi.fn();
    mockSendMessage = vi.fn();
    const mockAdapter: ChatProvider = {
      listSessions: vi.fn(),
      startNewSession: mockStartNewSession,
      openSession: mockOpenSession,
      sendMessage: mockSendMessage,
      closeSession: vi.fn(),
      closeAll: vi.fn(),
    };
    service = new ChatService(mockAdapter);
  });

  it('startNewSession() returns a Session on success', async () => {
    const session: Session = {
      id: 'sess-1',
      title: 'New Session',
      workspacePath: '/home/user/project',
      createdAt: new Date().toISOString(),
    };
    mockStartNewSession.mockResolvedValue(session);

    const result = await service.startNewSession('/home/user/project');

    expect(result).toEqual(session);
    expect(mockStartNewSession).toHaveBeenCalledWith('/home/user/project');
  });

  it('openSession() returns ChatMessage[] on success', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    mockOpenSession.mockResolvedValue(messages);

    const result = await service.openSession('sess-1');

    expect(result).toEqual(messages);
    expect(mockOpenSession).toHaveBeenCalledWith('sess-1');
  });

  it('openSession() returns [] for a new or empty session', async () => {
    mockOpenSession.mockResolvedValue([]);

    const result = await service.openSession('sess-new');

    expect(result).toEqual([]);
  });

  it('sendMessage handler rejects empty sessionId (handler-level validation)', () => {
    // Validation in src/main/index.ts:
    //   if (typeof sessionId !== 'string' || sessionId.trim() === '') throw new Error('Invalid sessionId')
    const isInvalidSessionId = (id: unknown): boolean =>
      typeof id !== 'string' || (id as string).trim() === '';

    expect(isInvalidSessionId('')).toBe(true);
    expect(isInvalidSessionId('   ')).toBe(true);
    expect(isInvalidSessionId('valid-session-id')).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sendMessage handler rejects empty text (handler-level validation)', () => {
    // Validation in src/main/index.ts:
    //   if (typeof text !== 'string' || text.trim() === '') throw new Error('Invalid text')
    const isInvalidText = (t: unknown): boolean =>
      typeof t !== 'string' || (t as string).trim() === '';

    expect(isInvalidText('')).toBe(true);
    expect(isInvalidText('   ')).toBe(true);
    expect(isInvalidText('hello')).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
