import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { keyLabel, vibrate } from '../lib/keys'
import type { LayerId } from '../lib/keys'

const HOLD_DELAY_MS = 400
const REPEAT_MS = 70

interface KeyButtonProps {
  def: KeyDefinition
  shift: boolean
  caps: boolean
  activeModifier: boolean
  haptic: boolean
  onPress: (code: string, key: string, def: KeyDefinition) => void
  onRelease: (code: string, key: string) => void
  onLayerChange?: (target: LayerId) => void
}

export default function KeyButton({
  def,
  shift,
  caps,
  activeModifier,
  haptic,
  onPress,
  onRelease,
  onLayerChange,
}: KeyButtonProps) {
  const [pressed, setPressed] = useState(false)
  const label = keyLabel(def, shift, caps)
  const className = [
    'key',
    def.kind,
    def.code === 'Space' ? 'key-space' : '',
    def.code === 'Backspace' ? 'key-backspace' : '',
    def.code === 'Enter' ? 'key-enter' : '',
    def.code === 'ShiftLeft' || def.code === 'ShiftRight' ? 'key-shift' : '',
    activeModifier ? 'active' : '',
    pressed ? 'is-pressed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const onPressRef = useRef<(code: string, key: string, def: KeyDefinition) => void>(onPress)
  const onReleaseRef = useRef<(code: string, key: string) => void>(onRelease)
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

  // If the button unmounts (e.g. the layer switches while the key is held),
  // the hold-to-repeat timers must be cleared or they keep typing forever.
  useEffect(() => {
    return () => {
      if (repeatDelayRef.current) clearTimeout(repeatDelayRef.current)
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current)
    }
  }, [])

  const handlePointerDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (def.kind === 'layer') {
      if (haptic) vibrate()
      if (def.layerTarget) onLayerChange?.(def.layerTarget)
      return
    }
    setPressed(true)
    const key = def.kind === 'char' ? labelRef.current : def.label
    onPressRef.current(def.code, key, def)
    // Hold-to-repeat for momentary keys only (never modifiers).
    if (def.kind === 'modifier') return
    repeatDelayRef.current = setTimeout(() => {
      repeatTimerRef.current = setInterval(() => {
        onPressRef.current(
          def.code,
          def.kind === 'char' ? labelRef.current : def.label,
          def,
        )
      }, REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  const handlePointerUp = () => {
    stopRepeat()
    if (pressed) {
      setPressed(false)
      onReleaseRef.current(def.code, def.kind === 'char' ? labelRef.current : def.label)
    }
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
      {def.kind === 'char' && <span className="key-peek">{label}</span>}
      <span>{label}</span>
    </button>
  )
}
