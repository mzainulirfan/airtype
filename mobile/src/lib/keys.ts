import type { Modifiers } from '../types'

export type LayerId = 'letters' | 'symbols' | 'extended' | 'fn' | 'nav'

export interface KeyDefinition {
  code: string
  label: string
  kind: 'char' | 'modifier' | 'special' | 'layer' | 'punct'
  shiftLabel?: string
  /** Symbol keys always type their exact label (Android symbols layer). */
  symbol?: boolean
  layerTarget?: LayerId
}

export interface KeyRow {
  keys: KeyDefinition[]
}

export interface KeyLayer {
  id: LayerId
  label: string
  rows: KeyRow[]
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

const symbolKey = (code: string, label: string): KeyDefinition => ({
  code,
  label,
  kind: 'char',
  symbol: true,
})

const layerKey = (code: string, label: string, target: LayerId): KeyDefinition => ({
  code,
  label,
  kind: 'layer',
  layerTarget: target,
})

const modifierKey = (code: string, label: string): KeyDefinition => ({
  code,
  label,
  kind: 'modifier',
})

const specialKey = (code: string, label: string): KeyDefinition => ({
  code,
  label,
  kind: 'special',
})

/** Quick punctuation key: tap types the default, long-press shows options. */
const punctKey = (label: string): KeyDefinition => ({
  code: 'PunctQuick',
  label,
  kind: 'punct',
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

/* ---------- Letters layer (Android/Gboard QWERTY) ---------- */

const LETTERS_ROW_1: KeyRow = {
  keys: [
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
  ],
}

const LETTERS_ROW_2: KeyRow = {
  keys: [
    charKey('KeyA', 'a', 'A'),
    charKey('KeyS', 's', 'S'),
    charKey('KeyD', 'd', 'D'),
    charKey('KeyF', 'f', 'F'),
    charKey('KeyG', 'g', 'G'),
    charKey('KeyH', 'h', 'H'),
    charKey('KeyJ', 'j', 'J'),
    charKey('KeyK', 'k', 'K'),
    charKey('KeyL', 'l', 'L'),
  ],
}

const LETTERS_ROW_3: KeyRow = {
  keys: [
    modifierKey('ShiftLeft', '⇧'),
    charKey('KeyZ', 'z', 'Z'),
    charKey('KeyX', 'x', 'X'),
    charKey('KeyC', 'c', 'C'),
    charKey('KeyV', 'v', 'V'),
    charKey('KeyB', 'b', 'B'),
    charKey('KeyN', 'n', 'N'),
    charKey('KeyM', 'm', 'M'),
    specialKey('Backspace', '⌫'),
  ],
}

const LETTERS_ROW_4: KeyRow = {
  keys: [
    modifierKey('ControlLeft', 'Ctrl'),
    modifierKey('AltLeft', 'Alt'),
    modifierKey('MetaLeft', 'Win'),
    specialKey('Space', ' '),
    punctKey(','),
    specialKey('Enter', '⏎'),
  ],
}

/* ---------- Symbols layer (Gboard ?123) ---------- */

const SYMBOLS_ROW_1: KeyRow = {
  keys: [
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
  ],
}

const SYMBOLS_ROW_2: KeyRow = {
  keys: [
    charKey('Minus', '-', '_'),
    charKey('Slash', '/', '?'),
    symbolKey('SymColon', ':'),
    symbolKey('SymSemicolon', ';'),
    symbolKey('SymLParen', '('),
    symbolKey('SymRParen', ')'),
    symbolKey('SymDollar', '$'),
    symbolKey('SymAmp', '&'),
    symbolKey('SymAt', '@'),
    symbolKey('SymQuote', '"'),
  ],
}

const SYMBOLS_ROW_3: KeyRow = {
  keys: [
    charKey('Period', '.', '>'),
    charKey('Comma', ',', '<'),
    symbolKey('SymQuestion', '?'),
    symbolKey('SymExclaim', '!'),
    symbolKey('SymApostrophe', "'"),
    specialKey('Backspace', '⌫'),
  ],
}

const SYMBOLS_ROW_4: KeyRow = {
  keys: [
    layerKey('LayerLetters', 'ABC', 'letters'),
    layerKey('LayerExtended', '#+=', 'extended'),
    specialKey('Space', ' '),
    specialKey('Enter', '⏎'),
  ],
}

/* ---------- Extended symbols layer (Gboard #+=) ---------- */

const EXTENDED_ROW_1: KeyRow = {
  keys: [
    charKey('BracketLeft', '[', '{'),
    charKey('BracketRight', ']', '}'),
    symbolKey('SymBraceL', '{'),
    symbolKey('SymBraceR', '}'),
    symbolKey('SymHash', '#'),
    symbolKey('SymPercent', '%'),
    symbolKey('SymCaret', '^'),
    symbolKey('SymStar', '*'),
    symbolKey('SymPlus', '+'),
    charKey('Equal', '=', '+'),
  ],
}

const EXTENDED_ROW_2: KeyRow = {
  keys: [
    symbolKey('SymUnderscore', '_'),
    charKey('Backslash', '\\', '|'),
    symbolKey('SymPipe', '|'),
    symbolKey('SymLess', '<'),
    symbolKey('SymGreater', '>'),
    symbolKey('SymTilde', '~'),
    symbolKey('SymEuro', '€'),
    symbolKey('SymDivide', '÷'),
    symbolKey('SymMultiply', '×'),
    specialKey('Backspace', '⌫'),
  ],
}

const EXTENDED_ROW_3: KeyRow = {
  keys: [
    specialKey('Tab', 'Tab'),
    specialKey('ArrowLeft', '←'),
    specialKey('ArrowUp', '↑'),
    specialKey('ArrowDown', '↓'),
    specialKey('ArrowRight', '→'),
  ],
}

const EXTENDED_ROW_4: KeyRow = {
  keys: [
    layerKey('LayerLetters', 'ABC', 'letters'),
    layerKey('LayerSymbols', '?123', 'symbols'),
    specialKey('Space', ' '),
    specialKey('Enter', '⏎'),
  ],
}

/* ---------- Fn layer (PC keys) ---------- */

const FN_ROW_1: KeyRow = {
  keys: [
    modifierKey('ControlLeft', 'Ctrl'),
    modifierKey('AltLeft', 'Alt'),
    modifierKey('MetaLeft', 'Win'),
  ],
}

const FN_ROW_2: KeyRow = {
  keys: Array.from({ length: 6 }, (_, i) => specialKey(`F${i + 1}`, `F${i + 1}`)),
}

const FN_ROW_3: KeyRow = {
  keys: Array.from({ length: 6 }, (_, i) => specialKey(`F${i + 7}`, `F${i + 7}`)),
}

const FN_ROW_4: KeyRow = {
  keys: [
    specialKey('Home', 'Home'),
    specialKey('End', 'End'),
    specialKey('PageUp', 'PgUp'),
    specialKey('PageDown', 'PgDn'),
    specialKey('Delete', 'Del'),
    specialKey('Backspace', '⌫'),
  ],
}

const FN_ROW_5: KeyRow = {
  keys: [
    specialKey('ArrowLeft', '←'),
    specialKey('ArrowUp', '↑'),
    specialKey('ArrowDown', '↓'),
    specialKey('ArrowRight', '→'),
  ],
}

const FN_ROW_6: KeyRow = {
  keys: [
    specialKey('Space', ' '),
    specialKey('Enter', '⏎'),
  ],
}

/* ---------- Nav layer (Win+Tab task view navigation) ---------- */

const NAV_ROW_1: KeyRow = {
  keys: [
    specialKey('ArrowLeft', '←'),
    specialKey('ArrowUp', '↑'),
    specialKey('ArrowRight', '→'),
  ],
}

const NAV_ROW_2: KeyRow = {
  keys: [
    specialKey('Escape', 'Esc'),
    specialKey('ArrowDown', '↓'),
    specialKey('Enter', '⏎'),
  ],
}

const NAV_ROW_3: KeyRow = {
  keys: [
    layerKey('LayerLetters', 'ABC', 'letters'),
    specialKey('Space', ' '),
    specialKey('Backspace', '⌫'),
  ],
}

export const LAYERS: KeyLayer[] = [
  {
    id: 'letters',
    label: 'ABC',
    rows: [LETTERS_ROW_1, LETTERS_ROW_2, LETTERS_ROW_3, LETTERS_ROW_4],
  },
  {
    id: 'symbols',
    label: '?123',
    rows: [SYMBOLS_ROW_1, SYMBOLS_ROW_2, SYMBOLS_ROW_3, SYMBOLS_ROW_4],
  },
  {
    id: 'extended',
    label: '#+=',
    rows: [EXTENDED_ROW_1, EXTENDED_ROW_2, EXTENDED_ROW_3, EXTENDED_ROW_4],
  },
  {
    id: 'fn',
    label: 'Fn',
    rows: [FN_ROW_1, FN_ROW_2, FN_ROW_3, FN_ROW_4, FN_ROW_5, FN_ROW_6],
  },
  {
    id: 'nav',
    label: 'Nav',
    rows: [NAV_ROW_1, NAV_ROW_2, NAV_ROW_3],
  },
]

export function getLayer(id: LayerId): KeyLayer {
  return LAYERS.find((l) => l.id === id) ?? LAYERS[0]
}

export function keyLabel(def: KeyDefinition, shift: boolean, caps: boolean): string {
  if (def.kind !== 'char' || def.symbol) return def.label
  const base = shift ? def.shiftLabel ?? def.label : def.label
  return caps ? base.toUpperCase() : base
}

export function isPureText(key: string): boolean {
  return key.length === 1
}

/** Special keys must always be sent as key events, never as text.
 * Some have single-glyph labels (⌫, ⏎, ←) that would otherwise look
 * like pure text and get fast-pathed. */
const SPECIAL_CODES = new Set([
  'Enter',
  'NumpadEnter',
  'Backspace',
  'Tab',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
])

export function isSpecialCode(code: string): boolean {
  return SPECIAL_CODES.has(code)
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
