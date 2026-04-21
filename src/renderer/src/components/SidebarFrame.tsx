import type { Session, Workspace } from '../../../shared/workspace-types';
import { SessionItem } from './SessionItem';
import { WorkspaceItem } from './WorkspaceItem';

interface SidebarFrameProps {
  workspaces: Workspace[];
  activeWorkspacePath: string | null;
  sessions: Session[] | null;
  activeSessionId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onAddWorkspace: () => void;
  onSelectSession: (session: Session) => void;
  onNewChat: () => void;
  startingChat: boolean;
  onLogout: () => void;
}

export const SidebarFrame = ({
  workspaces,
  activeWorkspacePath,
  sessions,
  activeSessionId,
  onSelectWorkspace,
  onAddWorkspace,
  onSelectSession,
  onNewChat,
  startingChat,
  onLogout,
}: SidebarFrameProps) => (
  <aside className="flex h-full w-[280px] shrink-0 flex-col justify-between border-r border-border bg-panel/80 px-5 py-6">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-textMuted">Workspaces</h2>
        <button
          type="button"
          onClick={onAddWorkspace}
          aria-label="Add workspace"
          className="focus-ring flex h-6 w-6 items-center justify-center rounded-control text-textMuted hover:text-text"
        >
          +
        </button>
      </div>
      {workspaces.length === 0 && (
        <div className="rounded-panel border border-dashed border-border bg-panelElevated/70 px-4 py-5">
          <p className="text-sm text-textSecondary">
            Your workspace list will appear here once you open your first project.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {workspaces.map((workspace) => (
          <WorkspaceItem
            key={workspace.path}
            workspace={workspace}
            isActive={workspace.path === activeWorkspacePath}
            onClick={() => onSelectWorkspace(workspace)}
          />
        ))}
      </div>
      {activeWorkspacePath !== null && (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onNewChat}
            disabled={startingChat}
            className="focus-ring flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-textMuted hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span aria-hidden="true">{startingChat ? '…' : '+'}</span>
            {startingChat ? 'Starting…' : 'New chat'}
          </button>
          {sessions !== null && sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => onSelectSession(session)}
            />
          ))}
        </div>
      )}
    </div>
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="focus-ring inline-flex items-center justify-center rounded-control border border-border px-4 py-3 text-sm font-medium text-textSecondary"
      >
        Settings
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="focus-ring inline-flex items-center justify-center rounded-control px-4 py-3 text-sm font-medium text-textMuted hover:text-textSecondary"
      >
        Log out
      </button>
    </div>
  </aside>
);
