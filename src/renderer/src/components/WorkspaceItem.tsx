import type { Workspace } from '../../../shared/workspace-types';

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
  onClick: () => void;
}

export const WorkspaceItem = ({ workspace, isActive, onClick }: WorkspaceItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`focus-ring flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm font-medium transition-colors ${
      isActive ? 'text-accent' : 'text-textSecondary hover:text-text'
    }`}
  >
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M1 3.5C1 2.67 1.67 2 2.5 2H5.5L7 3.5H11.5C12.33 3.5 13 4.17 13 5V10.5C13 11.33 12.33 12 11.5 12H2.5C1.67 12 1 11.33 1 10.5V3.5Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
    <span className="truncate">{workspace.name}</span>
  </button>
);
