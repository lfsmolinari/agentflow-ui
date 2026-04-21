interface WorkspaceEmptyStateProps {
  onNewChat: () => void;
  startingChat: boolean;
}

export const WorkspaceEmptyState = ({ onNewChat, startingChat }: WorkspaceEmptyStateProps) => (
  <main className="flex flex-1 items-center justify-center bg-bg px-10 py-12">
    <div className="flex w-full max-w-3xl flex-col items-center rounded-panel border border-border bg-panel px-10 py-16 text-center shadow-shell">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-panelElevated text-2xl">💬</div>
      <h1 className="text-4xl font-semibold tracking-tight text-text">No chats yet</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-textSecondary">
        Start a new chat to begin working with Strategist in this workspace.
      </p>
      <button
        type="button"
        onClick={onNewChat}
        disabled={startingChat}
        className="focus-ring mt-8 rounded-control bg-accent px-6 py-3 text-sm font-semibold text-accentFg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {startingChat ? 'Starting…' : 'New chat'}
      </button>
    </div>
  </main>
);
