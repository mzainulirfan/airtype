import { useState, type ReactNode } from 'react'
import {
  useSettings,
  type CursorSensitivity,
  type KeySize,
  type ThemePreference,
} from '../context/SettingsContext'
import { QUICK_ACTIONS } from '../lib/chords'
import type { ConnectionStatus } from '../types'
import TemplateManager from './TemplateManager'

interface SettingsPanelProps {
  onClose: () => void
  sessionId: string
  connectionStatus: ConnectionStatus
  desktopStatus: 'waiting_pairing' | 'connected' | 'paused' | null
  paused: boolean
  deviceName?: string
  lastSeenAt?: number | null
  onReconnect: () => void
  onDisconnect: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  reconnecting: 'Menyambung ulang…',
  disconnected: 'Terputus',
}

interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'active' : ''}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

function Row({
  label,
  hint,
  stack,
  children,
}: {
  label: string
  hint?: string
  stack?: boolean
  children: ReactNode
}) {
  return (
    <div className={stack ? 'settings-row stacked' : 'settings-row'}>
      <div className="settings-row-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value}</span>
    </div>
  )
}

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return 'Belum ada'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s} detik lalu`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} menit lalu`
  return new Date(ts).toLocaleTimeString()
}

export default function SettingsPanel({
  onClose,
  sessionId,
  connectionStatus,
  desktopStatus,
  paused,
  deviceName,
  lastSeenAt,
  onReconnect,
  onDisconnect,
}: SettingsPanelProps) {
  const { settings, update } = useSettings()
  const [copied, setCopied] = useState(false)

  const statusText = paused
    ? 'Dijeda'
    : desktopStatus === 'connected'
      ? 'Terhubung'
      : STATUS_LABEL[connectionStatus]
  const shortSession =
    sessionId.length > 18 ? `${sessionId.slice(0, 8)}…${sessionId.slice(-6)}` : sessionId

  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div>
            <h2>Pengaturan</h2>
            <p>Sesuaikan AirType di perangkat ini</p>
          </div>
          <button type="button" className="close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-group">
            <h3 className="settings-group-title">Koneksi</h3>
            <div className="settings-card">
              <div className="conn-summary">
                <span className={`conn-dot ${paused ? 'paused' : connectionStatus}`} />
                <div className="conn-summary-text">
                  <strong>{statusText}</strong>
                  <span>{deviceName ?? 'Perangkat tidak dikenal'}</span>
                </div>
              </div>
              <InfoRow label="Terakhir aktif" value={timeAgo(lastSeenAt)} />
              <div className="info-row session-row">
                <span className="info-row-label">ID sesi</span>
                <span className="session-id">
                  <code title={sessionId}>{shortSession}</code>
                  <button
                    type="button"
                    className="copy-id-btn"
                    onClick={copySession}
                    aria-label="Salin ID sesi"
                  >
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </span>
              </div>
            </div>
            <p className="settings-section-hint">
              Status terlihat terhubung tetapi PC tidak merespons? Sambungkan ulang.
            </p>
            <button type="button" className="settings-action" onClick={onReconnect}>
              Sambungkan ulang
            </button>
          </section>

          <section className="settings-group">
            <h3 className="settings-group-title">Ketikan</h3>
            <div className="settings-card">
              <Row label="Pratinjau ketikan" hint="Tampilkan teks di atas touchpad">
                <Switch
                  checked={settings.showTypingPreview}
                  onChange={(v) => update({ showTypingPreview: v })}
                />
              </Row>
              <Row label="Getar (haptik)" hint="Getaran halus saat tombol ditekan">
                <Switch checked={settings.haptic} onChange={(v) => update({ haptic: v })} />
              </Row>
              <Row label="Kembali ke huruf otomatis" hint="Setelah memakai layer PC atau navigasi">
                <Switch
                  checked={settings.autoReturnToLetters}
                  onChange={(v) => update({ autoReturnToLetters: v })}
                />
              </Row>
              <Row label="Mode tombol ketat" hint="Kirim ketukan asli, cocok untuk game">
                <Switch
                  checked={settings.strictMode}
                  onChange={(v) => update({ strictMode: v })}
                />
              </Row>
              <Row label="Sensitivitas kursor" hint="Kecepatan kursor dan scroll" stack>
                <Segmented<CursorSensitivity>
                  options={[
                    { value: 1, label: 'Rendah' },
                    { value: 1.5, label: 'Sedang' },
                    { value: 2, label: 'Tinggi' },
                  ]}
                  value={settings.cursorSensitivity}
                  onChange={(v) => update({ cursorSensitivity: v })}
                />
              </Row>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group-title">Tampilan</h3>
            <div className="settings-card">
              <Row label="Ukuran tombol" stack>
                <Segmented<KeySize>
                  options={[
                    { value: 'small', label: 'Kecil' },
                    { value: 'default', label: 'Sedang' },
                    { value: 'large', label: 'Besar' },
                  ]}
                  value={settings.keySize}
                  onChange={(v) => update({ keySize: v })}
                />
              </Row>
              <Row label="Tema" stack>
                <Segmented<ThemePreference>
                  options={[
                    { value: 'system', label: 'Sistem' },
                    { value: 'light', label: 'Terang' },
                    { value: 'dark', label: 'Gelap' },
                  ]}
                  value={settings.theme}
                  onChange={(v) => update({ theme: v })}
                />
              </Row>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group-title">Pintasan Favorit</h3>
            <div className="settings-card settings-card-padded">
              <p className="settings-section-hint">Pintasan yang tampil di baris utama.</p>
              <div className="fav-grid">
                {QUICK_ACTIONS.map((chord) => {
                  const active = settings.favoriteShortcuts.includes(chord.label)
                  return (
                    <button
                      key={chord.label}
                      type="button"
                      className={`fav-chip ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => {
                        const next = active
                          ? settings.favoriteShortcuts.filter((l) => l !== chord.label)
                          : [...settings.favoriteShortcuts, chord.label]
                        update({ favoriteShortcuts: next })
                      }}
                    >
                      {chord.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group-title">Templat Teks</h3>
            <div className="settings-card settings-card-padded">
              <p className="settings-section-hint">
                Teks berulang yang bisa disisipkan sekali ketuk dari tombol Templat.
              </p>
              <TemplateManager />
            </div>
          </section>

          <button type="button" className="disconnect-btn" onClick={onDisconnect}>
            Putuskan koneksi
          </button>
        </div>
      </div>
    </div>
  )
}