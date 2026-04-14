export const ShellEmptyState = () => (
  <main className="flex flex-1 items-center justify-center bg-bg px-10 py-12">
    <div className="flex w-full max-w-3xl flex-col items-center rounded-panel border border-border bg-panel px-10 py-16 text-center shadow-shell">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-panelElevated text-2xl">⌘</div>
      <h1 className="text-4xl font-semibold tracking-tight text-text">Start a new project</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-textSecondary">
        Open a folder to begin using AgentFlow UI. Workspace and session navigation will appear in the left rail once
        a project is selected.
      </p>
      <button
        type="button"
        disabled
        aria-describedby="start-project-disabled-note"
        className="focus-ring mt-8 rounded-control bg-accent px-6 py-3 text-sm font-semibold text-accentFg disabled:cursor-not-allowed disabled:opacity-60"
      >
        Start a new project
      </button>
      <p id="start-project-disabled-note" className="mt-3 text-sm text-textMuted">
        Workspace selection starts in Milestone 2.
      </p>
    </div>
  </main>
);
