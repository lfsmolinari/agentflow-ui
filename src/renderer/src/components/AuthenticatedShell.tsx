import { SidebarFrame } from './SidebarFrame';
import { ShellEmptyState } from './ShellEmptyState';

export const AuthenticatedShell = () => (
  <div className="flex min-h-screen bg-bg p-4">
    <div className="flex w-full overflow-hidden rounded-[28px] border border-border bg-panel shadow-shell">
      <SidebarFrame />
      <ShellEmptyState />
    </div>
  </div>
);
