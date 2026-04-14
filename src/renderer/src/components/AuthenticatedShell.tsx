import { SidebarFrame } from './SidebarFrame';
import { ShellEmptyState } from './ShellEmptyState';

interface AuthenticatedShellProps {
  onLogout: () => void;
}

export const AuthenticatedShell = ({ onLogout }: AuthenticatedShellProps) => (
  <div className="flex min-h-screen bg-bg p-4">
    <div className="flex w-full overflow-hidden rounded-[28px] border border-border bg-panel shadow-shell">
      <SidebarFrame onLogout={onLogout} />
      <ShellEmptyState />
    </div>
  </div>
);
