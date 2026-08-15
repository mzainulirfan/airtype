import { Fragment } from 'react'
import type { PointerEvent } from 'react'
import type { Chord } from '../lib/chords'
import { QUICK_ACTION_GROUPS } from '../lib/chords'

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
      {QUICK_ACTION_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="qa-sep" aria-hidden="true" />}
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
        </Fragment>
      ))}
    </div>
  )
}
