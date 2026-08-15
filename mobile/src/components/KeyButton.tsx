import { useRef } from 'react'
import type { MouseEvent } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { keyLabel } from '../lib/keys'

const HOLD_DELAY_MS = 400
const REPEAT_MS = 70

interface KeyButtonProps {
  def: KeyDefinition
  shift: boolean
  caps: boolean
  activeModifier: boolean
  onPress: (code: string, key: string) => void
  onRelease: (code: string, key: string) => void
}

export default function KeyButton({
  def,
  shift,
  caps,
  activeModifier,
  onPress,
  onRelease,
}: KeyButtonProps) {
  const label = keyLabel(def, shift, caps)
  const className = [
    'key',
    def.kind,
    def.code === 'Space' ? 'key-space' : '',
    activeModifier ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const onPressRef = useRef(onPress)
  const onReleaseRef = useRef(onRelease)
  onPressRef.current = onPress
  onReleaseRef.current = onRelease

  const labelRef = useRef(label)
  labelRef.current = label

  const repeatDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopRepeat = () => {
    if (repeatDelayRef.current) {
      clearTimeout(repeatDelayRef.current)
      repeatDelayRef.current = null
    }
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
  }

  const handlePointerDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const key = def.kind === 'char' ? labelRef.current : def.label
    onPressRef.current(def.code, key)
    // Hold-to-repeat for momentary keys only (never modifiers).
    if (def.kind === 'modifier') return
    repeatDelayRef.current = setTimeout(() => {
      repeatTimerRef.current = setInterval(() => {
        onPressRef.current(def.code, def.kind === 'char' ? labelRef.current : def.label)
      }, REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  const handlePointerUp = () => {
    stopRepeat()
    onReleaseRef.current(def.code, def.kind === 'char' ? labelRef.current : def.label)
  }

  return (
    <button
      type="button"
      className={className}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
    </button>
  )
}
