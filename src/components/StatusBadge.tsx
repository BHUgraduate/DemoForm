import type { Status } from '../../shared/schema';

export const statusClass = (s: string) => 's-' + s.toLowerCase().replace(/\s+/g, '-');
export const STATUS_ICON: Record<Status, string> = {
  'Under Review': '●', Approved: '✓', Rejected: '✕', 'Needs Changes': '!', Processing: '◐', Completed: '★',
};
export const StatusBadge = ({ status, icon = false }: { status: string; icon?: boolean }) => (
  <span className={`badge ${statusClass(status)}`}>{icon && <span aria-hidden="true">{STATUS_ICON[status as Status] ?? '•'} </span>}{status}</span>
);
