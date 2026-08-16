import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { Chord } from '../lib/chords'
import { QUICK_ACTIONS } from '../lib/chords'
import ShortcutsSheet from './ShortcutsSheet'

interface ShortcutsBarProps {
  onChord: (chord: Chord) => void
  favorites: string[]
}

function findChord(label: string): Chord | undefined {
  return QUICK_ACTIONS.find((c) => c.label === label)
}

export default function ShortcutsBar({ onChord, favorites }: ShortcutsBarProps) {
  const [open, setOpen] = useState(false)

  const handlePress = (e: PointerEvent<HTMLButtonElement>, chord: Chord) => {
    e.preventDefault()
    onChord(chord)
  }

  return (
    <>
      <div className="shortcuts-bar">
        {favorites.map((label) => {
          const chord = findChord(label)
          if (!chord) return null
          return (
            <button
              key={label}
              type="button"
              className="qa-btn shortcut-pill"
              onPointerDown={(e) => handlePress(e, chord)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {chord.label}
            </button>
          )
        })}
        <button
          type="button"
          className="qa-btn shortcut-more"
          onClick={() => setOpen(true)}
          aria-label="Semua pintasan"
        >
          •••
        </button>
      </div>
      {open && <ShortcutsSheet onChord={onChord} onClose={() => setOpen(false)} />}
    </>
  )
}