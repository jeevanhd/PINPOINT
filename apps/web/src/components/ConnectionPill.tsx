import { useConnectionStatus } from '../hooks/useConnectionStatus';

const LABEL = {
  connected: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
} as const;

const DOT = {
  connected: 'var(--good)',
  connecting: 'var(--mustard)',
  reconnecting: 'var(--mustard)',
  offline: 'var(--bad)',
} as const;

/** Visible connection state, as the brief requires. */
export function ConnectionPill() {
  const status = useConnectionStatus();
  return (
    <span className="pill" title={`Realtime: ${LABEL[status]}`}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: DOT[status] }}
        aria-hidden
      />
      {LABEL[status]}
    </span>
  );
}
