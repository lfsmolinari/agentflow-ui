export interface InstallGateProps {
  onOpenInstall: () => Promise<void>;
}

export const InstallGate = ({ onOpenInstall }: InstallGateProps) => (
  <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
    <div className="w-full max-w-xl rounded-panel border border-border bg-panel px-8 py-12 shadow-shell">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-panelElevated text-lg font-semibold">
        AF
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-text">Copilot CLI required</h1>
      <p className="mt-4 text-base leading-7 text-textSecondary">
        AgentFlow UI depends on GitHub Copilot CLI to authenticate and run desktop workflows.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            void onOpenInstall();
          }}
          className="focus-ring rounded-control bg-accent px-5 py-3 text-sm font-semibold text-accentFg"
        >
          Install Copilot CLI
        </button>
        <p className="text-sm text-textMuted">Restart AgentFlow UI after installation to continue.</p>
      </div>
    </div>
  </div>
);
