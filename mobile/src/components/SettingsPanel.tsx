import type { ReactNode } from 'react'
import { useSettings, type KeySize, type ThemePreference } from '../context/SettingsContext'

interface SettingsPanelProps {
  onClose: () => void
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

function Segmented<T extends string>({
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

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, update } = useSettings()

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
          <Row label="Getar (haptic)" hint="Getaran halus saat tombol ditekan">
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

          <Row label="Mode key ketat" hint="Kirim ketukan asli alih-alih teks cepat (untuk game)">
            <Switch checked={settings.strictMode} onChange={(v) => update({ strictMode: v })} />
          </Row>
        </div>
      </div>
    </div>
  )
}
