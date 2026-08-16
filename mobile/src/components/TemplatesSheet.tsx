import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'

interface TemplatesSheetProps {
  onClose: () => void
  onInsert: (text: string) => void
}

export default function TemplatesSheet({ onClose, onInsert }: TemplatesSheetProps) {
  const { settings } = useSettings()
  const [clipboardStatus, setClipboardStatus] = useState<'idle' | 'reading' | 'manual'>('idle')
  const [manualText, setManualText] = useState('')

  const insert = (text: string) => {
    if (!text) return
    onInsert(text)
    onClose()
  }

  const handlePaste = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setClipboardStatus('manual')
      return
    }
    setClipboardStatus('reading')
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        insert(text)
      } else {
        // Clipboard exists but is empty — offer manual paste.
        setClipboardStatus('manual')
      }
    } catch {
      // Permission denied or unsupported — fall back to manual paste.
      setClipboardStatus('manual')
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Templates</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="sheet-body">
          <section className="sheet-group">
            <h3>Tempel dari Clipboard</h3>
            <button
              type="button"
              className="paste-btn"
              onClick={handlePaste}
              disabled={clipboardStatus === 'reading'}
            >
              {clipboardStatus === 'reading' ? 'Membaca clipboard…' : 'Tempel dari Clipboard'}
            </button>
            <p className="settings-section-hint">
              Mengambil teks yang terakhir kamu salin di HP (butuh izin clipboard).
            </p>
            {clipboardStatus === 'manual' && (
              <div className="paste-manual">
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Tempel teks di sini (tahan lama di kotak ini), lalu kirim…"
                  rows={4}
                />
                <button
                  type="button"
                  className="paste-btn"
                  onClick={() => insert(manualText)}
                  disabled={!manualText.trim()}
                >
                  Kirim ke PC
                </button>
              </div>
            )}
          </section>

          <section className="sheet-group">
            <h3>Template Tersimpan</h3>
            {settings.templates.length === 0 ? (
              <p className="settings-section-hint">
                Belum ada template. Tambahkan di Pengaturan → Template Teks.
              </p>
            ) : (
              settings.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="template-row"
                  onClick={() => insert(t.content)}
                >
                  <span className="template-name">{t.name}</span>
                  <span className="template-preview">{t.content}</span>
                </button>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}