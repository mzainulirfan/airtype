import type { MouseEvent } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { keyLabel } from '../lib/keys'

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

  const handlePointerDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onPress(def.code, def.kind === 'char' ? label : def.label)
  }

  const handlePointerUp = () => {
    onRelease(def.code, def.kind === 'char' ? label : def.label)
  }

  return (
    <button
      type="button"
      className={className}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
    </button>
  )
}
