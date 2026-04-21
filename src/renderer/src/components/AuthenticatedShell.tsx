import { useWorkspaceState } from '../hooks/useWorkspaceState';
import { ChatView } from './ChatView';
import { SessionLoadError } from './SessionLoadError';
import { ShellEmptyState } from './ShellEmptyState';
import { SidebarFrame } from './SidebarFrame';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

interface AuthenticatedShellProps {
  onLogout: () => void;
}

export const AuthenticatedShell = ({ onLogout }: AuthenticatedShellProps) => {
  const { viewState, workspaces, selectWorkspace, addWorkspace, startNewChat, openSession, sendMessage } = useWorkspaceState();

  const activeWorkspacePath =
    viewState.kind !== 'no_workspace' ? viewState.workspace.path : null;
  const sessions =
    viewState.kind === 'workspace_selected'
      ? viewState.sessions
      : viewState.kind === 'active_session'
      ? viewState.sessions
      : null;
  const activeSessionId =
    viewState.kind === 'active_session' ? viewState.session.id : null;
  const startingChat =
    viewState.kind === 'workspace_selected' ? viewState.startingChat : false;

  let mainContent: React.ReactNode;
  if (viewState.kind === 'no_workspace') {
    mainContent = <ShellEmptyState onStart={addWorkspace} />;
  } else if (viewState.kind === 'workspace_selected') {
    if (viewState.sessionError) {
      mainContent = <SessionLoadError onRetry={() => selectWorkspace(viewState.workspace)} />;
    } else {
      mainContent = <WorkspaceEmptyState onNewChat={startNewChat} startingChat={startingChat} />;
    }
  } else {
    mainContent = (
      <ChatView
        messages={viewState.messages}
        streamingChunk={viewState.streamingChunk}
        isStreaming={viewState.streaming}
        onSend={sendMessage}
      />
    );
  }

  return (
    <div className="flex h-screen bg-bg p-4">
      <div className="flex h-full w-full overflow-hidden rounded-[28px] border border-border bg-panel shadow-shell">
        <SidebarFrame
          workspaces={workspaces}
          activeWorkspacePath={activeWorkspacePath}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectWorkspace={selectWorkspace}
          onAddWorkspace={addWorkspace}
          onSelectSession={openSession}
          onNewChat={startNewChat}
          startingChat={startingChat}
          onLogout={onLogout}
        />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {mainContent}
        </div>
      </div>
    </div>
  );
};
