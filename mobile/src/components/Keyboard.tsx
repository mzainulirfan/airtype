import type { KeyRow } from '../lib/keys'
import { ALL_ROWS, NAV_KEYS, FUNCTION_KEYS } from '../lib/keys'
import type { Modifiers } from '../types'
import KeyButton from './KeyButton'

interface KeyboardProps {
  modifiers: Modifiers
  shiftLatch: boolean
  capsLock: boolean
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

function renderRow(
  row: KeyRow,
  modifiers: Modifiers,
  shiftLatch: boolean,
  capsLock: boolean,
  onPress: KeyboardProps['onPress'],
  onRelease: KeyboardProps['onRelease'],
) {
  const shift = modifiers.shift || shiftLatch
  return (
    <div className="key-row" key={`row-${row.keys[0].code}`}>
      {row.keys.map((def) => (
        <KeyButton
          key={def.code}
          def={def}
          shift={shift}
          caps={capsLock}
          activeModifier={isModifierActive(def.code, modifiers)}
          onPress={onPress}
          onRelease={onRelease}
        />
      ))}
    </div>
  )
}

export default function Keyboard({
  modifiers,
  shiftLatch,
  capsLock,
  onPress,
  onRelease,
}: KeyboardProps) {
  return (
    <div className="keyboard">
      {renderRow(NAV_KEYS, modifiers, shiftLatch, capsLock, onPress, onRelease)}
      {ALL_ROWS.map((row) =>
        renderRow(row, modifiers, shiftLatch, capsLock, onPress, onRelease),
      )}
      {renderRow(FUNCTION_KEYS, modifiers, shiftLatch, capsLock, onPress, onRelease)}
    </div>
  )
}
