import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { Chord } from '../lib/chords'
import { QUICK_ACTIONS } from '../lib/chords'
import ShortcutsSheet from './ShortcutsSheet'
import TemplatesSheet from './TemplatesSheet'

interface ShortcutsBarProps {
  onChord: (chord: Chord) => void
  onInsertText: (text: string) => void
  favorites: string[]
}

function findChord(label: string): Chord | undefined {
  return QUICK_ACTIONS.find((c) => c.label === label)
}

export default function ShortcutsBar({ onChord, onInsertText, favorites }: ShortcutsBarProps) {
  const [open, setOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const handlePress = (e: PointerEvent<HTMLButtonElement>, chord: Chord) => {
    e.preventDefault()
    onChord(chord)
  }

  return (
    <>
      <div className="shortcuts-bar">
        <div className="shortcuts-scroll">
          {favorites.map((label) => {
            const chord = findChord(label)
            if (!chord) return null
            return (
              <button
                key={label}
                type="button"
                className="shortcut-pill"
                onPointerDown={(e) => handlePress(e, chord)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {chord.label}
              </button>
            )
          })}
        </div>
        <div className="shortcuts-actions">
          <button
            type="button"
            className="shortcut-action"
            onClick={() => setTemplatesOpen(true)}
            aria-label="Buka templat teks"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
              <path d="M14 3v5h5M12 11v6M9 14h6" />
            </svg>
            <span>Templat</span>
          </button>
          <button
            type="button"
            className="shortcut-action icon-only"
            onClick={() => setOpen(true)}
            aria-label="Semua pintasan"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="2" />
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="12" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
            </svg>
          </button>
        </div>
      </div>
      {open && <ShortcutsSheet onChord={onChord} onClose={() => setOpen(false)} />}
      {templatesOpen && (
        <TemplatesSheet onInsert={onInsertText} onClose={() => setTemplatesOpen(false)} />
      )}
    </>
  )
}
