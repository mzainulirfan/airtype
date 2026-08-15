import type { ConnectionStatus } from '../types'

interface StatusBarProps {
  status: ConnectionStatus
  paused: boolean
  onTogglePause: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  reconnecting: 'Menyambung ulang…',
  disconnected: 'Terputus',
}

export default function StatusBar({ status, paused, onTogglePause }: StatusBarProps) {
  const cls = paused ? 'paused' : status
  return (
    <div className={`status-bar ${cls}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">
        {paused ? 'Dijeda' : STATUS_LABEL[status]}
      </span>
      <button type="button" onClick={onTogglePause} className="pause-btn">
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  )
}
