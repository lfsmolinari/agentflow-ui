export const SidebarFrame = () => (
  <aside className="flex h-full w-[280px] shrink-0 flex-col justify-between border-r border-border bg-panel/80 px-5 py-6">
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-textMuted">Workspaces</h2>
      </div>
      <div className="rounded-panel border border-dashed border-border bg-panelElevated/70 px-4 py-5">
        <p className="text-sm text-textSecondary">
          Your workspace list will appear here once you open your first project.
        </p>
      </div>
    </div>
    <button
      type="button"
      className="focus-ring inline-flex items-center justify-center rounded-control border border-border px-4 py-3 text-sm font-medium text-textSecondary"
    >
      Settings
    </button>
  </aside>
);
