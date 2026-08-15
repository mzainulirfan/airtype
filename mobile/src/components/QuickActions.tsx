import type { PointerEvent } from 'react'
import type { Chord } from '../lib/chords'
import { QUICK_ACTIONS } from '../lib/chords'

interface QuickActionsProps {
  onChord: (chord: Chord) => void
}

export default function QuickActions({ onChord }: QuickActionsProps) {
  const handlePress = (e: PointerEvent<HTMLButtonElement>, chord: Chord) => {
    e.preventDefault()
    onChord(chord)
  }

  return (
    <div className="quick-actions">
      {QUICK_ACTIONS.map((chord) => (
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
  )
}
