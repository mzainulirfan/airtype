import type { PointerEvent } from 'react'
import type { Chord } from '../lib/chords'
import { QUICK_ACTION_GROUPS } from '../lib/chords'

interface ShortcutsSheetProps {
  onChord: (chord: Chord) => void
  onClose: () => void
}

const GROUP_TITLES = ['Papan Klip', 'Pengeditan', 'Jendela & Navigasi', 'Sistem', 'Sering Dipakai']

export default function ShortcutsSheet({ onChord, onClose }: ShortcutsSheetProps) {
  const handlePress = (e: PointerEvent<HTMLButtonElement>, chord: Chord) => {
    e.preventDefault()
    onChord(chord)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Pintasan</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="sheet-body">
          {QUICK_ACTION_GROUPS.map((group, gi) => (
            <section key={gi} className="sheet-group">
              <h3>{GROUP_TITLES[gi] ?? 'Lainnya'}</h3>
              <div className="sheet-grid">
                {group.map((chord) => (
                  <button
                    key={chord.label}
                    type="button"
                    className="qa-btn"
                    onPointerDown={(e) => handlePress(e, chord)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {chord.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}