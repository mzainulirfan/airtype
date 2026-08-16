import type { ReactNode } from 'react'
import {
  useSettings,
  type CursorSensitivity,
  type KeySize,
  type ThemePreference,
} from '../context/SettingsContext'
import { getChannelName } from '../lib/supabase'
import { QUICK_ACTIONS } from '../lib/chords'
import type { ConnectionStatus } from '../types'

interface SettingsPanelProps {
  onClose: () => void
  sessionId: string
  connectionStatus: ConnectionStatus
  desktopStatus: 'waiting_pairing' | 'connected' | 'paused' | null
  paused: boolean
  deviceName?: string
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

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
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

export default function SettingsPanel({
  onClose,
  sessionId,
  connectionStatus,
  desktopStatus,
  paused,
  deviceName,
  onDisconnect,
}: SettingsPanelProps) {
  const { settings, update } = useSettings()

  const statusText = paused
    ? 'Dijeda'
    : desktopStatus === 'connected'
      ? 'Terhubung'
      : STATUS_LABEL[connectionStatus]

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Pengaturan</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">Info Koneksi</h3>
            <InfoRow label="Perangkat" value={deviceName ?? 'Perangkat tidak dikenal'} />
            <InfoRow label="Status" value={statusText} />
            <InfoRow label="ID Sesi" value={getChannelName(sessionId)} />
          </section>

          <section className="settings-section">
            <Row label="Tampilkan pratinjau ketikan" hint="Pratinjau teks di atas touchpad">
              <Switch
                checked={settings.showTypingPreview}
                onChange={(v) => update({ showTypingPreview: v })}
              />
            </Row>
            <Row label="Getar (haptik)" hint="Getaran halus saat tombol ditekan">
              <Switch checked={settings.haptic} onChange={(v) => update({ haptic: v })} />
            </Row>

            <Row label="Ukuran tombol">
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

            <Row label="Tema">
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

            <Row label="Kembali ke huruf otomatis" hint="Setelah mengetik di layer simbol/Fn">
              <Switch
                checked={settings.autoReturnToLetters}
                onChange={(v) => update({ autoReturnToLetters: v })}
              />
            </Row>

            <Row label="Mode tombol ketat" hint="Kirim ketukan asli alih-alih teks cepat (untuk game)">
              <Switch checked={settings.strictMode} onChange={(v) => update({ strictMode: v })} />
            </Row>

            <Row label="Sensitivitas kursor" hint="Kecepatan gerak kursor & scroll touchpad">
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
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Pintasan Favorit</h3>
            <p className="settings-section-hint">Pintasan yang tampil di baris utama.</p>
            <div className="fav-grid">
              {QUICK_ACTIONS.map((chord) => {
                const active = settings.favoriteShortcuts.includes(chord.label)
                return (
                  <button
                    key={chord.label}
                    type="button"
                    className={`fav-chip ${active ? 'active' : ''}`}
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
          </section>

          <section className="settings-section">
            <button type="button" className="disconnect-btn" onClick={onDisconnect}>
              Putuskan koneksi
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}