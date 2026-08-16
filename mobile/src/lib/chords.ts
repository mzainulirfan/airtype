import type { Modifiers } from '../types'
import type { GestureName } from '../types'

export interface Chord {
  label: string
  key: { code: string; key: string }
  mods: Partial<Modifiers>
  /** Hold the modifier briefly before/after the tap. Needed for OS shell
   * shortcuts like Alt+Tab that only respond to a real held modifier. */
  hold?: boolean
}

export const QUICK_ACTION_GROUPS: Chord[][] = [
  [
    { label: 'Ctrl+A', key: { code: 'KeyA', key: 'a' }, mods: { ctrl: true } },
    { label: 'Ctrl+C', key: { code: 'KeyC', key: 'c' }, mods: { ctrl: true } },
    { label: 'Ctrl+X', key: { code: 'KeyX', key: 'x' }, mods: { ctrl: true } },
    { label: 'Ctrl+V', key: { code: 'KeyV', key: 'v' }, mods: { ctrl: true } },
  ],
  [
    { label: 'Ctrl+Z', key: { code: 'KeyZ', key: 'z' }, mods: { ctrl: true } },
    { label: 'Ctrl+Y', key: { code: 'KeyY', key: 'y' }, mods: { ctrl: true } },
    { label: 'Ctrl+S', key: { code: 'KeyS', key: 's' }, mods: { ctrl: true } },
    { label: 'Ctrl+F', key: { code: 'KeyF', key: 'f' }, mods: { ctrl: true } },
  ],
  [
    { label: 'Tab', key: { code: 'Tab', key: 'Tab' }, mods: {} },
    { label: 'Alt+Tab', key: { code: 'Tab', key: 'Tab' }, mods: { alt: true }, hold: true },
    { label: 'Win+Tab', key: { code: 'Tab', key: 'Tab' }, mods: { meta: true }, hold: true },
    { label: 'Ctrl+W', key: { code: 'KeyW', key: 'w' }, mods: { ctrl: true } },
    { label: 'Esc', key: { code: 'Escape', key: 'Escape' }, mods: {} },
  ],
]

export const QUICK_ACTIONS: Chord[] = QUICK_ACTION_GROUPS.flat()

/** Chords triggered by trackpad multi-finger gestures. */
export const GESTURE_CHORDS: Record<Exclude<GestureName, 'middle_click'>, Chord> = {
  back: { label: 'Alt+Left', key: { code: 'ArrowLeft', key: 'ArrowLeft' }, mods: { alt: true } },
  forward: { label: 'Alt+Right', key: { code: 'ArrowRight', key: 'ArrowRight' }, mods: { alt: true } },
  task_view: { label: 'Win+Tab', key: { code: 'Tab', key: 'Tab' }, mods: { meta: true }, hold: true },
  show_desktop: { label: 'Win+D', key: { code: 'KeyD', key: 'd' }, mods: { meta: true }, hold: true },
  desktop_next: {
    label: 'Win+Ctrl+Right',
    key: { code: 'ArrowRight', key: 'ArrowRight' },
    mods: { meta: true, ctrl: true },
    hold: true,
  },
  desktop_prev: {
    label: 'Win+Ctrl+Left',
    key: { code: 'ArrowLeft', key: 'ArrowLeft' },
    mods: { meta: true, ctrl: true },
    hold: true,
  },
  zoom_in: { label: 'Ctrl+Plus', key: { code: 'Equal', key: '=' }, mods: { ctrl: true } },
  zoom_out: { label: 'Ctrl+Minus', key: { code: 'Minus', key: '-' }, mods: { ctrl: true } },
}
