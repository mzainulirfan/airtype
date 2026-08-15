import { useState } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { getLayer, type LayerId } from '../lib/keys'
import type { Modifiers } from '../types'
import KeyButton from './KeyButton'

interface KeyboardProps {
  modifiers: Modifiers
  shiftLatch: boolean
  capsLock: boolean
  autoReturnToLetters: boolean
  haptic: boolean
  onPress: (code: string, key: string, def?: KeyDefinition) => void
  onRelease: (code: string, key: string) => void
}

function isModifierActive(code: string, modifiers: Modifiers, capsLock: boolean): boolean {
  switch (code) {
    case 'ShiftLeft':
    case 'ShiftRight':
      return modifiers.shift || capsLock
    case 'ControlLeft':
    case 'ControlRight':
      return modifiers.ctrl
    case 'AltLeft':
    case 'AltRight':
      return modifiers.alt
    case 'MetaLeft':
      return modifiers.meta
    default:
      return false
  }
}

export default function Keyboard({
  modifiers,
  shiftLatch,
  capsLock,
  autoReturnToLetters,
  haptic,
  onPress,
  onRelease,
}: KeyboardProps) {
  const [layer, setLayer] = useState<LayerId>('letters')
  const layerDef = getLayer(layer)
  const shift = modifiers.shift || shiftLatch

  const handleLayerChange = (target: LayerId) => {
    setLayer(target)
  }

  const handlePress = (code: string, key: string, def?: KeyDefinition) => {
    // Only auto-return from the fn layer (function keys are momentary by
    // nature). The symbols/#+= layers stay put like a normal phone keyboard.
    const isMomentary =
      def?.kind === 'char' ||
      (def?.kind === 'special' &&
        (def.code === 'Space' || def.code === 'Enter' || layer === 'fn'))
    if (autoReturnToLetters && layer === 'fn' && isMomentary) {
      setLayer('letters')
    }
    onPress(code, key, def)
  }

  return (
    <div className="keyboard">
      {layerDef.rows.map((row, rowIdx) => (
        <div className="key-row" key={`${layer}-${rowIdx}`}>
          {row.keys.map((def) => (
            <KeyButton
              key={def.code}
              def={def}
              shift={shift}
              caps={capsLock}
              activeModifier={isModifierActive(def.code, modifiers, capsLock)}
              haptic={haptic}
              onPress={handlePress}
              onRelease={onRelease}
              onLayerChange={handleLayerChange}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
