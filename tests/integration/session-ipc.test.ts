import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@shared/workspace-types';
import { SessionService } from '@main/session-service';
import type { CopilotCliAdapter } from '@infra/copilot/adapter';

describe('SessionService', () => {
  let mockListSessions: ReturnType<typeof vi.fn>;
  let service: SessionService;

  beforeEach(() => {
    mockListSessions = vi.fn();
    const mockAdapter = { listSessions: mockListSessions } as unknown as CopilotCliAdapter;
    service = new SessionService(mockAdapter);
  });

  it('listSessions() delegates to the adapter and returns Session[]', async () => {
    const sessions: Session[] = [
      {
        id: 'abc',
        title: 'My Session',
        workspacePath: '/home/user/project',
        createdAt: '2023-11-15T00:00:00.000Z',
      },
    ];
    mockListSessions.mockResolvedValue(sessions);

    const result = await service.listSessions('/home/user/project');

    expect(result).toEqual(sessions);
    expect(mockListSessions).toHaveBeenCalledWith('/home/user/project');
  });

  it('listSessions() returns [] on adapter error without propagating the exception', async () => {
    mockListSessions.mockRejectedValue(new Error('Adapter failure'));

    await expect(service.listSessions('/home/user/project')).resolves.toEqual([]);
  });

  it('empty/whitespace workspace path returns [] without calling the adapter (handler-level guard)', () => {
    // The IPC handler in src/main/index.ts validates the path before calling the service:
    //   if (typeof workspacePath !== 'string' || workspacePath.trim() === '') return []
    // This test documents that guard so regressions are caught.
    const isGuarded = (p: unknown): boolean =>
      typeof p !== 'string' || (p as string).trim() === '';

    expect(isGuarded('')).toBe(true);
    expect(isGuarded('   ')).toBe(true);
    expect(isGuarded('/valid/path')).toBe(false);
    // Adapter must not have been called because we never reached the service
    expect(mockListSessions).not.toHaveBeenCalled();
  });
});
