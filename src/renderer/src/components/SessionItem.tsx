import type { Session } from '../../../shared/workspace-types';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return createdAt;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getSessionTitle(session: Session): string {
  if (session.title && session.title.trim()) return session.title;
  if (session.createdAt) return formatCreatedAt(session.createdAt);
  return 'Session';
}

export const SessionItem = ({ session, isActive, onClick }: SessionItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`focus-ring flex w-full flex-col rounded-control px-2 py-1.5 pl-6 text-left text-sm transition-colors ${
      isActive
        ? 'bg-panelElevated text-text'
        : 'text-textSecondary hover:text-text'
    }`}
  >
    <span className="truncate">{getSessionTitle(session)}</span>
    {session.createdAt && (
      <span className="mt-0.5 text-xs text-textMuted">{formatCreatedAt(session.createdAt)}</span>
    )}
  </button>
);
