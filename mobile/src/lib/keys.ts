import type { Modifiers } from '../types'

export interface KeyDefinition {
  code: string
  label: string
  kind: 'char' | 'modifier' | 'special' | 'action'
  shiftLabel?: string
}

export interface KeyRow {
  keys: KeyDefinition[]
}

const modifiers = (shift = false, ctrl = false, alt = false, meta = false): Modifiers => ({
  shift,
  ctrl,
  alt,
  meta,
})

const charKey = (code: string, label: string, shiftLabel: string): KeyDefinition => ({
  code,
  label,
  shiftLabel,
  kind: 'char',
})

export const MODIFIER_KEYS: Record<string, (active: boolean) => Modifiers> = {
  ShiftLeft: () => modifiers(true),
  ControlLeft: () => modifiers(false, true),
  AltLeft: () => modifiers(false, false, true),
  MetaLeft: () => modifiers(false, false, false, true),
}

export function applyModifierToggle(current: Modifiers, code: string, active: boolean): Modifiers {
  const patch = MODIFIER_KEYS[code]?.(active)
  if (!patch) return current
  return { ...current, ...patch }
}

export const NUMBER_ROW: KeyRow = {
  keys: [
    charKey('Backquote', '`', '~'),
    charKey('Digit1', '1', '!'),
    charKey('Digit2', '2', '@'),
    charKey('Digit3', '3', '#'),
    charKey('Digit4', '4', '$'),
    charKey('Digit5', '5', '%'),
    charKey('Digit6', '6', '^'),
    charKey('Digit7', '7', '&'),
    charKey('Digit8', '8', '*'),
    charKey('Digit9', '9', '('),
    charKey('Digit0', '0', ')'),
    charKey('Minus', '-', '_'),
    charKey('Equal', '=', '+'),
    { code: 'Backspace', label: 'Backspace', kind: 'special' },
  ],
}

export const QWERTY_ROW_1: KeyRow = {
  keys: [
    { code: 'Tab', label: 'Tab', kind: 'special' },
    charKey('KeyQ', 'q', 'Q'),
    charKey('KeyW', 'w', 'W'),
    charKey('KeyE', 'e', 'E'),
    charKey('KeyR', 'r', 'R'),
    charKey('KeyT', 't', 'T'),
    charKey('KeyY', 'y', 'Y'),
    charKey('KeyU', 'u', 'U'),
    charKey('KeyI', 'i', 'I'),
    charKey('KeyO', 'o', 'O'),
    charKey('KeyP', 'p', 'P'),
    charKey('BracketLeft', '[', '{'),
    charKey('BracketRight', ']', '}'),
    charKey('Backslash', '\\', '|'),
  ],
}

export const QWERTY_ROW_2: KeyRow = {
  keys: [
    { code: 'CapsLock', label: 'caps', kind: 'modifier' },
    charKey('KeyA', 'a', 'A'),
    charKey('KeyS', 's', 'S'),
    charKey('KeyD', 'd', 'D'),
    charKey('KeyF', 'f', 'F'),
    charKey('KeyG', 'g', 'G'),
    charKey('KeyH', 'h', 'H'),
    charKey('KeyJ', 'j', 'J'),
    charKey('KeyK', 'k', 'K'),
    charKey('KeyL', 'l', 'L'),
    charKey('Semicolon', ';', ':'),
    charKey('Quote', "'", '"'),
    { code: 'Enter', label: 'Enter', kind: 'special' },
  ],
}

export const QWERTY_ROW_3: KeyRow = {
  keys: [
    { code: 'ShiftLeft', label: 'Shift', kind: 'modifier' },
    charKey('KeyZ', 'z', 'Z'),
    charKey('KeyX', 'x', 'X'),
    charKey('KeyC', 'c', 'C'),
    charKey('KeyV', 'v', 'V'),
    charKey('KeyB', 'b', 'B'),
    charKey('KeyN', 'n', 'N'),
    charKey('KeyM', 'm', 'M'),
    charKey('Comma', ',', '<'),
    charKey('Period', '.', '>'),
    charKey('Slash', '/', '?'),
    { code: 'ShiftRight', label: 'Shift', kind: 'modifier' },
  ],
}

export const BOTTOM_ROW: KeyRow = {
  keys: [
    { code: 'ControlLeft', label: 'Ctrl', kind: 'modifier' },
    { code: 'AltLeft', label: 'Alt', kind: 'modifier' },
    { code: 'MetaLeft', label: 'Win', kind: 'modifier' },
    { code: 'Space', label: ' ', kind: 'special' },
    { code: 'ArrowLeft', label: '←', kind: 'special' },
    { code: 'ArrowUp', label: '↑', kind: 'special' },
    { code: 'ArrowDown', label: '↓', kind: 'special' },
    { code: 'ArrowRight', label: '→', kind: 'special' },
    { code: 'AltRight', label: 'Alt', kind: 'modifier' },
    { code: 'ControlRight', label: 'Ctrl', kind: 'modifier' },
  ],
}

export const NAV_KEYS: KeyRow = {
  keys: [
    { code: 'Home', label: 'Home', kind: 'special' },
    { code: 'End', label: 'End', kind: 'special' },
    { code: 'PageUp', label: 'PgUp', kind: 'special' },
    { code: 'PageDown', label: 'PgDn', kind: 'special' },
    { code: 'Delete', label: 'Del', kind: 'special' },
  ],
}

export const FUNCTION_KEYS: KeyRow = {
  keys: Array.from({ length: 12 }, (_, i) => ({
    code: `F${i + 1}`,
    label: `F${i + 1}`,
    kind: 'special' as const,
  })),
}

export const ALL_ROWS: KeyRow[] = [NUMBER_ROW, QWERTY_ROW_1, QWERTY_ROW_2, QWERTY_ROW_3, BOTTOM_ROW]

export function keyLabel(def: KeyDefinition, shift: boolean, caps: boolean): string {
  if (def.kind !== 'char') return def.label
  const base = shift ? def.shiftLabel ?? def.label : def.label
  return caps ? base.toUpperCase() : base
}

export function isPureText(key: string): boolean {
  return key.length === 1
}

export function isModifierCode(code: string): boolean {
  return Boolean(MODIFIER_KEYS[code])
}

/** Haptic feedback on supported mobile browsers. No-op elsewhere. */
export function vibrate(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* blocked or unsupported */
  }
}
