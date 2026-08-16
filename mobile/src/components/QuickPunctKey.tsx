import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { vibrate } from '../lib/keys'

const QUICK_PUNCTS = [',', '.', '?', '!', ':', ';', "'", '"']
const LONG_PRESS_MS = 350

// Remember the last chosen punctuation for the current session so plain taps
// keep typing it even after the keyboard layer switches.
let quickPunctDefault = ','

interface QuickPunctKeyProps {
  haptic: boolean
  onPress: (code: string, key: string, def: KeyDefinition) => void
}

function typeChar(
  onPress: (code: string, key: string, def: KeyDefinition) => void,
  ch: string,
) {
  onPress('PunctQuick', ch, { code: 'PunctQuick', label: ch, kind: 'char', symbol: true })
}

export default function QuickPunctKey({ haptic, onPress }: QuickPunctKeyProps) {
  const [open, setOpen] = useState(false)
  const longPressRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => clearTimer, [])

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setOpen(false)
    longPressRef.current = false
    if (haptic) vibrate(6)
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressRef.current = true
      setOpen(true)
      if (haptic) vibrate()
    }, LONG_PRESS_MS)
  }

  const handlePointerUp = () => {
    clearTimer()
    if (!longPressRef.current) {
      typeChar(onPress, quickPunctDefault)
    }
  }

  const handlePointerCancel = () => {
    clearTimer()
    longPressRef.current = false
    setOpen(false)
  }

  const choose = (ch: string) => {
    quickPunctDefault = ch
    longPressRef.current = false
    setOpen(false)
    typeChar(onPress, ch)
  }

  return (
    <>
      {open && <div className="punct-backdrop" onPointerDown={handlePointerCancel} />}
      <div className="key-punct-wrap">
        <button
          type="button"
          className="key special key-punct"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span>{quickPunctDefault}</span>
          <span className="key-punct-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <div className="punct-popup">
            {QUICK_PUNCTS.map((ch) => (
              <button
                key={ch}
                type="button"
                className={`punct-option ${ch === quickPunctDefault ? 'active' : ''}`}
                onClick={() => choose(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}