import type { ConnectionStatus } from '../types'

interface StatusBarProps {
  status: ConnectionStatus
  paused: boolean
  desktopStatus: 'waiting_pairing' | 'connected' | 'paused' | null
  onTogglePause: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  reconnecting: 'Menyambung ulang…',
  disconnected: 'Terputus',
}

const DESKTOP_LABEL: Record<string, string> = {
  waiting_pairing: 'Desktop menunggu pairing',
  connected: 'Desktop terhubung',
  paused: 'Desktop dijeda',
}

export default function StatusBar({ status, paused, desktopStatus, onTogglePause }: StatusBarProps) {
  const cls = paused ? 'paused' : status
  return (
    <div className={`status-bar ${cls}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">
        {paused ? 'Dijeda' : STATUS_LABEL[status]}
      </span>
      {desktopStatus && !paused && (
        <span className="desktop-status">{DESKTOP_LABEL[desktopStatus]}</span>
      )}
      <button type="button" onClick={onTogglePause} className="pause-btn">
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  )
}
