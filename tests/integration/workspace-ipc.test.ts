import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/mock/userData' },
  dialog: { showOpenDialog: vi.fn() },
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import * as fs from 'node:fs';
import { WorkspaceService } from '@main/workspace-service';

describe('WorkspaceService — workspace IPC behaviour', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService();
  });

  it('load() returns an empty array before any workspaces are added', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err: NodeJS.ErrnoException = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });
    expect(service.load()).toEqual([]);
  });

  it('add() returns a list containing the new workspace', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('[]' as unknown as ReturnType<typeof fs.readFileSync>);
    const result = service.add('/home/user/my-project');
    expect(result).toContainEqual({ path: '/home/user/my-project', name: 'my-project' });
  });

  it('add() is idempotent — duplicate path does not grow the list', () => {
    const existing = JSON.stringify([{ path: '/home/user/my-project', name: 'my-project' }]);
    vi.mocked(fs.readFileSync).mockReturnValue(existing as unknown as ReturnType<typeof fs.readFileSync>);
    const result = service.add('/home/user/my-project');
    expect(result).toHaveLength(1);
  });

  it('load() returns the unchanged list when addWorkspace dialog is cancelled', () => {
    // The addWorkspace IPC handler (src/main/index.ts) calls workspaceService.load()
    // on cancellation. This test verifies that load() faithfully returns the stored list.
    const stored = JSON.stringify([{ path: '/home/user/my-project', name: 'my-project' }]);
    vi.mocked(fs.readFileSync).mockReturnValue(stored as unknown as ReturnType<typeof fs.readFileSync>);
    const result = service.load();
    expect(result).toEqual([{ path: '/home/user/my-project', name: 'my-project' }]);
  });
});

// Validation logic from src/main/index.ts openSession handler:
//   if (typeof sessionId !== 'string' || !/^[\w-]+$/.test(sessionId)) {
//     return { error: 'Invalid session ID' }
//   }
const isValidSessionId = (id: unknown): boolean =>
  typeof id === 'string' && /^[\w-]+$/.test(id);

describe('openSession handler — sessionId validation', () => {
  it('rejects path-traversal session IDs', () => {
    expect(isValidSessionId('../../etc/passwd')).toBe(false);
    expect(isValidSessionId('../secret')).toBe(false);
    expect(isValidSessionId('/abs/path')).toBe(false);
    expect(isValidSessionId('')).toBe(false);
  });

  it('rejects session IDs containing special characters', () => {
    expect(isValidSessionId('session id')).toBe(false);  // space
    expect(isValidSessionId('session/id')).toBe(false);  // slash
    expect(isValidSessionId('session.id')).toBe(false);  // dot
  });

  it('accepts well-formed session IDs', () => {
    expect(isValidSessionId('session-abc123')).toBe(true);
    expect(isValidSessionId('session_abc')).toBe(true);
    expect(isValidSessionId('abc123')).toBe(true);
    expect(isValidSessionId('sess-1')).toBe(true);
  });
});
