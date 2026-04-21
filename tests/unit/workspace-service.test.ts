import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workspace } from '@shared/workspace-types';

vi.mock('electron', () => ({
  app: { getPath: () => '/mock/userData' },
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import * as fs from 'node:fs';
import { WorkspaceService } from '@main/workspace-service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService();
  });

  describe('load()', () => {
    it('returns [] when the file does not exist (ENOENT)', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const err: NodeJS.ErrnoException = new Error('ENOENT: no such file');
        err.code = 'ENOENT';
        throw err;
      });
      expect(service.load()).toEqual([]);
    });

    it('returns the parsed array when the file exists with valid JSON', () => {
      const workspaces: Workspace[] = [{ path: '/home/user/project', name: 'project' }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(workspaces) as unknown as ReturnType<typeof fs.readFileSync>);
      expect(service.load()).toEqual(workspaces);
    });

    it('returns [] when the file contains invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json{{{' as unknown as ReturnType<typeof fs.readFileSync>);
      expect(service.load()).toEqual([]);
    });
  });

  describe('add()', () => {
    it('appends a new path and returns the updated list', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('[]' as unknown as ReturnType<typeof fs.readFileSync>);
      const result = service.add('/home/user/project');
      expect(result).toEqual([{ path: '/home/user/project', name: 'project' }]);
    });

    it('returns the list unchanged for a duplicate path (deduplication)', () => {
      const existing: Workspace[] = [{ path: '/home/user/project', name: 'project' }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existing) as unknown as ReturnType<typeof fs.readFileSync>);
      const result = service.add('/home/user/project');
      expect(result).toEqual(existing);
      expect(result).toHaveLength(1);
    });
  });

  describe('save()', () => {
    it('writes valid JSON to the expected path via atomic tmp-then-rename', () => {
      const workspaces: Workspace[] = [{ path: '/home/user/project', name: 'project' }];
      service.save(workspaces);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/userData/agentflow-workspaces.json.tmp',
        JSON.stringify(workspaces, null, 2),
        'utf-8',
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        '/mock/userData/agentflow-workspaces.json.tmp',
        '/mock/userData/agentflow-workspaces.json',
      );
    });
  });
});
