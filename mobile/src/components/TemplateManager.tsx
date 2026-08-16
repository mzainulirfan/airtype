import { useState } from 'react'
import { useSettings, type TemplateItem } from '../context/SettingsContext'

const MAX_CONTENT = 2000

function newId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export default function TemplateManager() {
  const { settings, update } = useSettings()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateItem | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')

  const reset = () => {
    setEditing(null)
    setName('')
    setContent('')
  }

  const startAdd = () => {
    reset()
    setFormOpen(true)
  }

  const startEdit = (t: TemplateItem) => {
    setEditing(t)
    setName(t.name)
    setContent(t.content)
    setFormOpen(true)
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed || !content.trim()) return
    if (editing) {
      update({
        templates: settings.templates.map((t) =>
          t.id === editing.id ? { ...t, name: trimmed, content } : t,
        ),
      })
    } else {
      update({ templates: [...settings.templates, { id: newId(), name: trimmed, content }] })
    }
    setFormOpen(false)
    reset()
  }

  const remove = (id: string) => {
    update({ templates: settings.templates.filter((t) => t.id !== id) })
    if (editing?.id === id) {
      setFormOpen(false)
      reset()
    }
  }

  return (
    <div className="tpl-manager">
      {settings.templates.length === 0 && !formOpen && (
        <p className="settings-section-hint">
          Belum ada template. Template = teks berulang (alamat, salam, kode, dll.) yang bisa
          disisipkan sekali ketuk dari sheet Templates.
        </p>
      )}

      {settings.templates.map((t) => (
        <div className="tpl-row" key={t.id}>
          <div className="tpl-info">
            <span className="tpl-name">{t.name}</span>
            <span className="tpl-preview">{t.content}</span>
          </div>
          <div className="tpl-actions">
            <button type="button" className="tpl-btn" onClick={() => startEdit(t)}>
              Edit
            </button>
            <button type="button" className="tpl-btn tpl-danger" onClick={() => remove(t.id)}>
              Hapus
            </button>
          </div>
        </div>
      ))}

      {formOpen ? (
        <div className="tpl-form">
          <input
            className="tpl-input"
            placeholder="Nama (mis. Alamat rumah)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <textarea
            className="tpl-input tpl-textarea"
            placeholder="Isi teks template…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CONTENT}
            rows={4}
          />
          <div className="tpl-form-actions">
            <button type="button" className="tpl-btn tpl-primary" onClick={save} disabled={!name.trim() || !content.trim()}>
              Simpan
            </button>
            <button
              type="button"
              className="tpl-btn"
              onClick={() => {
                setFormOpen(false)
                reset()
              }}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="tpl-add" onClick={startAdd}>
          + Tambah template
        </button>
      )}
    </div>
  )
}