interface SessionLoadErrorProps {
  onRetry: () => void;
}

export function SessionLoadError({ onRetry }: SessionLoadErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-textSecondary">
      <p className="text-sm">Failed to load sessions for this workspace.</p>
      <button type="button" onClick={onRetry} className="text-sm text-accent hover:underline">
        Retry
      </button>
    </div>
  );
}
