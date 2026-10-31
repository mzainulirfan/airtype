import type { ConnectionStatus } from '../types'

export type LandscapeMode = 'touchpad' | 'keyboard'

interface StatusBarProps {
  status: ConnectionStatus
  paused: boolean
  desktopStatus: 'waiting_pairing' | 'waiting_approval' | 'connected' | 'paused' | null
  deviceName?: string
  mode?: LandscapeMode
  onToggleMode?: () => void
  onTogglePause: (paused: boolean) => void
  onOpenSettings: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  reconnecting: 'Menyambung ulang…',
  disconnected: 'Terputus',
}

function statusSubtitle(
  status: ConnectionStatus,
  paused: boolean,
  desktopStatus: StatusBarProps['desktopStatus'],
  deviceName?: string,
): string {
  if (paused) return 'Ketikan dihentikan sementara'
  if (status !== 'connected') return 'Pastikan Desktop Helper terbuka'
  if (desktopStatus === 'waiting_approval') return 'Menunggu persetujuan desktop'
  if (desktopStatus === 'waiting_pairing') return 'Desktop menunggu pairing'
  if (desktopStatus === 'paused') return 'Desktop sedang dijeda'
  return deviceName || 'Desktop siap menerima ketikan'
}

export default function StatusBar({
  status,
  paused,
  desktopStatus,
  deviceName,
  mode,
  onToggleMode,
  onTogglePause,
  onOpenSettings,
}: StatusBarProps) {
  const cls = paused ? 'paused' : status
  const label = paused ? 'Dijeda' : STATUS_LABEL[status]
  const subtitle = statusSubtitle(status, paused, desktopStatus, deviceName)

  return (
    <div className={`status-bar ${cls}`}>
      <div className="status-main">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">
          <span className="status-label">{label}</span>
          <span className="status-sub">{subtitle}</span>
        </span>
      </div>

      {mode && onToggleMode && (
        <div className="mode-switch" role="group" aria-label="Mode layar landscape">
          <button
            type="button"
            className={mode === 'keyboard' ? 'active' : ''}
            aria-pressed={mode === 'keyboard'}
            onClick={() => mode !== 'keyboard' && onToggleMode()}
          >
            Keyboard
          </button>
          <button
            type="button"
            className={mode === 'touchpad' ? 'active' : ''}
            aria-pressed={mode === 'touchpad'}
            onClick={() => mode !== 'touchpad' && onToggleMode()}
          >
            Mouse
          </button>
        </div>
      )}

      <div className="status-actions">
        <button
          type="button"
          className={`icon-btn pause-toggle ${paused ? 'active' : ''}`}
          onClick={() => onTogglePause(!paused)}
          aria-label={paused ? 'Lanjutkan ketikan' : 'Jeda ketikan'}
          aria-pressed={paused}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <rect x="7" y="5" width="3.5" height="14" rx="1.2" />
              <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Buka pengaturan"
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
