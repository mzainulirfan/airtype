import { useMemo, useState } from 'react'
import type { KeyDefinition } from '../lib/keys'
import { getLayer, vibrate, type LayerId } from '../lib/keys'
import type { Modifiers } from '../types'
import KeyButton from './KeyButton'

interface KeyboardProps {
  modifiers: Modifiers
  shiftLatch: boolean
  capsLock: boolean
  autoReturnToLetters: boolean
  haptic: boolean
  onPress: (code: string, key: string) => void
  onRelease: (code: string, key: string) => void
}

function isModifierActive(code: string, modifiers: Modifiers): boolean {
  switch (code) {
    case 'ShiftLeft':
    case 'ShiftRight':
      return modifiers.shift
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

  const defLookup = useMemo(() => {
    const map = new Map<string, KeyDefinition>()
    for (const row of layerDef.rows) {
      for (const def of row.keys) {
        map.set(def.code, def)
      }
    }
    return map
  }, [layerDef])

  const handleLayerChange = (target: LayerId) => {
    setLayer(target)
  }

  const handlePress = (code: string, key: string) => {
    const def = defLookup.get(code)
    // Only auto-return from the fn layer (function keys are momentary by
    // nature). The symbols layer stays put like a normal phone keyboard, so
    // you can type several numbers/symbols before switching back to ABC.
    const isMomentary =
      def?.kind === 'char' ||
      (def?.kind === 'special' &&
        (def.code === 'Space' || def.code === 'Enter' || layer === 'fn'))
    if (autoReturnToLetters && layer === 'fn' && isMomentary) {
      setLayer('letters')
    }
    onPress(code, key)
  }

  return (
    <div className="keyboard">
      <div className="layer-bar" role="tablist" aria-label="Layer keyboard">
        {(['letters', 'symbols', 'fn'] as LayerId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={layer === id}
            className={`layer-tab ${layer === id ? 'active' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault()
              if (haptic) vibrate()
              setLayer(id)
            }}
          >
            {getLayer(id).label}
          </button>
        ))}
      </div>

      {layerDef.rows.map((row) => (
        <div className="key-row" key={`${layer}-${row.keys[0].code}`}>
          {row.keys.map((def) => (
            <KeyButton
              key={def.code}
              def={def}
              shift={shift}
              caps={capsLock}
              activeModifier={isModifierActive(def.code, modifiers)}
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
