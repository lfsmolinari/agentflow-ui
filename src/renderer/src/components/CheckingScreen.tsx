export const CheckingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="h-12 w-12 animate-pulse rounded-full border border-border bg-panelElevated" />
      <div>
        <h1 className="text-2xl font-semibold text-text">Checking environment</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Inspecting Copilot CLI availability and authentication state.
        </p>
      </div>
    </div>
  </div>
);
