export const statusClass = (s: string) => 's-' + s.toLowerCase().replace(/\s+/g, '-');
export const StatusBadge = ({ status }: { status: string }) => <span className={`badge ${statusClass(status)}`}>{status}</span>;
