import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { Workspace } from '@shared/workspace-types';

const getStoragePath = (): string =>
  path.join(app.getPath('userData'), 'agentflow-workspaces.json');

export class WorkspaceService {
  load(): Workspace[] {
    const filePath = getStoragePath();
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Workspace[];
      return [];
    } catch {
      return [];
    }
  }

  add(folderPath: string): Workspace[] {
    const workspaces = this.load();
    const already = workspaces.some((w) => w.path === folderPath);
    if (already) return workspaces;
    const updated = [...workspaces, { path: folderPath, name: path.basename(folderPath) }];
    this.save(updated);
    return updated;
  }

  save(workspaces: Workspace[]): void {
    const filePath = getStoragePath();
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(workspaces, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }
}
