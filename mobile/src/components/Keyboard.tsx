import type { KeyDefinition } from '../lib/keys'
import { getLayer, type LayerId } from '../lib/keys'
import type { Modifiers } from '../types'
import KeyButton from './KeyButton'
import QuickPunctKey from './QuickPunctKey'

interface KeyboardProps {
  modifiers: Modifiers
  shiftLatch: boolean
  capsLock: boolean
  autoReturnToLetters: boolean
  haptic: boolean
  layer: LayerId
  onLayerChange: (target: LayerId) => void
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
  layer,
  onLayerChange,
  onPress,
  onRelease,
}: KeyboardProps) {
  const layerDef = getLayer(layer)
  const shift = modifiers.shift || shiftLatch

  const handlePress = (code: string, key: string, def?: KeyDefinition) => {
    // Only auto-return from the fn layer (function keys are momentary by
    // nature) and from the nav layer when finishing the task view (Enter/Esc).
    // The symbols/#+= layers stay put like a normal phone keyboard.
    const isMomentary =
      def?.kind === 'char' ||
      (def?.kind === 'special' &&
        (def.code === 'Space' ||
          def.code === 'Enter' ||
          layer === 'fn' ||
          (layer === 'nav' && def.code === 'Escape')))
    if (autoReturnToLetters && (layer === 'fn' || layer === 'nav') && isMomentary) {
      onLayerChange('letters')
    }
    onPress(code, key, def)
  }

  return (
    <div className={layer === 'nav' ? 'keyboard nav' : 'keyboard'}>
      <div className="keyboard-toolbar">
        <button
          type="button"
          className={layer === 'letters' || layer === 'nav' ? 'keyboard-chip active' : 'keyboard-chip'}
          onClick={() => onLayerChange('letters')}
        >
          ABC
        </button>
        <button
          type="button"
          className={
            layer === 'symbols' || layer === 'extended' ? 'keyboard-chip active' : 'keyboard-chip'
          }
          onClick={() => onLayerChange('symbols')}
        >
          ?123
        </button>
        <button
          type="button"
          className={layer === 'fn' ? 'keyboard-chip active' : 'keyboard-chip'}
          onClick={() => onLayerChange('fn')}
        >
          PC
        </button>
      </div>
      {layerDef.rows.map((row, rowIdx) => (
        <div className="key-row" key={`${layer}-${rowIdx}`}>
          {row.keys.map((def) =>
            def.kind === 'punct' ? (
              <QuickPunctKey key={def.code} haptic={haptic} onPress={onPress} />
            ) : (
              <KeyButton
                key={def.code}
                def={def}
                shift={shift}
                caps={capsLock}
                activeModifier={isModifierActive(def.code, modifiers, capsLock)}
                haptic={haptic}
                onPress={handlePress}
                onRelease={onRelease}
                onLayerChange={onLayerChange}
              />
            ),
          )}
        </div>
      ))}
    </div>
  )
}
