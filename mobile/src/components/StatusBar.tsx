import type { ConnectionStatus } from '../types'

interface StatusBarProps {
  status: ConnectionStatus
  paused: boolean
  desktopStatus: 'waiting_pairing' | 'connected' | 'paused' | null
  deviceName?: string
  onTogglePause: () => void
  onOpenSettings: () => void
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

export default function StatusBar({
  status,
  paused,
  desktopStatus,
  deviceName,
  onTogglePause,
  onOpenSettings,
}: StatusBarProps) {
  const cls = paused ? 'paused' : status
  const label = paused ? 'Dijeda' : STATUS_LABEL[status]
  return (
    <div className={`status-bar ${cls}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">
        {status === 'connected' && !paused && deviceName ? `${deviceName} · ` : ''}
        {label}
      </span>
      {desktopStatus && !paused && (
        <span className="desktop-status">{DESKTOP_LABEL[desktopStatus]}</span>
      )}
      <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Pengaturan">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button type="button" onClick={onTogglePause} className="pause-btn">
        {paused ? 'Lanjutkan' : 'Jeda'}
      </button>
    </div>
  )
}