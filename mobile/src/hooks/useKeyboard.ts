import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BroadcastPayload,
  EchoToken,
  KeyEventPayload,
  Modifiers,
  MouseButton,
} from '../types'
import type { KeyDefinition } from '../lib/keys'
import { isModifierCode, isPureText, isSpecialCode, vibrate } from '../lib/keys'
import type { Chord } from '../lib/chords'

export interface KeyboardOptions {
  sessionId: string
  clientId: string
  send: (payload: BroadcastPayload) => boolean
  textBurstMs?: number
  paused?: boolean
  haptic?: boolean
  strictMode?: boolean
  onLatency?: (ms: number) => void
  /** Local echo of what would appear on the PC, for the on-screen preview. */
  onEcho?: (token: EchoToken) => void
}

let eventCounter = 0

function nextEventId(): string {
  eventCounter += 1
  return `evt-${eventCounter}-${Date.now().toString(36)}`
}

const initialModifiers: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

const MAX_BURST_CHARS = 12

const DOUBLE_TAP_SHIFT_MS = 320

/** How often to flush accumulated mouse-move deltas (ms). */
const MOUSE_MOVE_FLUSH_MS = 24

/** Map a non-text special key to its preview token. Only for keys that
 * visibly move the typed text (space/enter/tab/backspace/delete/navigation). */
function echoToken(code: string): EchoToken | null {
  switch (code) {
    case 'Space':
      return { type: 'insert', text: ' ' }
    case 'Enter':
    case 'NumpadEnter':
      return { type: 'enter' }
    case 'Tab':
      return { type: 'tab' }
    case 'Backspace':
      return { type: 'backspace' }
    case 'Delete':
      return { type: 'delete' }
    case 'ArrowLeft':
      return { type: 'left' }
    case 'ArrowRight':
      return { type: 'right' }
    case 'ArrowUp':
      return { type: 'up' }
    case 'ArrowDown':
      return { type: 'down' }
    case 'Home':
      return { type: 'home' }
    case 'End':
      return { type: 'end' }
    default:
      return null
  }
}

export function useKeyboard({
  sessionId,
  clientId,
  send,
  textBurstMs = 80,
  paused = false,
  haptic = true,
  strictMode = false,
  onLatency,
  onEcho,
}: KeyboardOptions) {
  const [modifiers, setModifiers] = useState<Modifiers>(initialModifiers)
  const [capsLock, setCapsLock] = useState(false)
  const modifiersRef = useRef(modifiers)
  modifiersRef.current = modifiers
  const capsLockRef = useRef(capsLock)
  capsLockRef.current = capsLock

  const bufferRef = useRef<string[]>([])
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendRef = useRef(send)
  const pausedRef = useRef(paused)
  const hapticRef = useRef(haptic)
  const strictModeRef = useRef(strictMode)
  const onEchoRef = useRef(onEcho)
  const lastShiftTapRef = useRef(0)
  const mouseAccXRef = useRef(0)
  const mouseAccYRef = useRef(0)
  const mouseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  sendRef.current = send
  pausedRef.current = paused
  hapticRef.current = haptic
  strictModeRef.current = strictMode
  onEchoRef.current = onEcho

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return
    const text = bufferRef.current.join('')
    bufferRef.current = []
    const sent = sendRef.current({
      type: 'type_text',
      sessionId,
      eventId: nextEventId(),
      clientId,
      text,
      timestamp: new Date().toISOString(),
    })
    if (sent) onLatency?.(0)
  }, [sessionId, clientId, onLatency])

  const scheduleFlush = useCallback(() => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(flushBuffer, textBurstMs)
  }, [flushBuffer, textBurstMs])

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
      if (mouseTimerRef.current) clearInterval(mouseTimerRef.current)
    }
  }, [])

  const sendKeyEvent = useCallback(
    (
      type: 'key_down' | 'key_up',
      code: string,
      key: string,
      mods: Modifiers = modifiersRef.current,
    ) => {
      const payload: KeyEventPayload = {
        type,
        sessionId,
        eventId: nextEventId(),
        clientId,
        code,
        key,
        modifiers: { ...mods },
        timestamp: new Date().toISOString(),
      }
      return sendRef.current(payload)
    },
    [sessionId, clientId],
  )

  const releaseShiftLatch = useCallback(() => {
    const mods = { ...modifiersRef.current, shift: false }
    setModifiers(mods)
    sendKeyEvent('key_up', 'ShiftLeft', 'Shift', mods)
  }, [sendKeyEvent])

  const toggleModifier = useCallback(
    (code: string, key: string) => {
      if (code === 'CapsLock') {
        setCapsLock((c) => !c)
        return
      }
      const next = { ...modifiersRef.current }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        const wasOn = modifiersRef.current.shift
        if (wasOn) {
          // Second tap: a quick follow-up toggles caps lock (like Android);
          // a slow one just releases the shift latch.
          const now = Date.now()
          if (now - lastShiftTapRef.current < DOUBLE_TAP_SHIFT_MS) {
            lastShiftTapRef.current = 0
            setCapsLock((c) => !c)
            setModifiers({ ...next, shift: false })
            sendKeyEvent('key_up', code, key, { ...modifiersRef.current, shift: false })
            return
          }
          lastShiftTapRef.current = 0
          next.shift = false
          setModifiers(next)
          sendKeyEvent('key_up', code, key, next)
          return
        }
        // First tap: latch shift and remember the time for double-tap detection.
        const now = Date.now()
        if (now - lastShiftTapRef.current < DOUBLE_TAP_SHIFT_MS) {
          // Was a very quick re-press: treat as double tap.
          lastShiftTapRef.current = 0
          setCapsLock((c) => !c)
          return
        }
        lastShiftTapRef.current = now
        next.shift = true
        setModifiers(next)
        sendKeyEvent('key_down', code, key, next)
        return
      }
      let active: boolean
      if (code === 'ControlLeft' || code === 'ControlRight') {
        next.ctrl = !next.ctrl
        active = next.ctrl
      } else if (code === 'AltLeft' || code === 'AltRight') {
        next.alt = !next.alt
        active = next.alt
      } else if (code === 'MetaLeft') {
        next.meta = !next.meta
        active = next.meta
      } else {
        return
      }
      setModifiers(next)
      sendKeyEvent(active ? 'key_down' : 'key_up', code, key, next)
    },
    [sendKeyEvent],
  )

  const press = useCallback(
    (code: string, key: string, def?: KeyDefinition) => {
      if (pausedRef.current) return
      if (hapticRef.current) vibrate()

      if (isModifierCode(code) || code === 'CapsLock') {
        toggleModifier(code, key)
        return
      }

      const { shift, ctrl, alt, meta } = modifiersRef.current

      // Fast-path: pure text, without ctrl/alt/meta, can be bundled as type_text.
      // Shift is safe here because the label already encodes the shift.
      // Symbol keys always use the fast-path (their label IS the exact char).
      if (
        isPureText(key) &&
        !isSpecialCode(code) &&
        !ctrl &&
        !alt &&
        !meta &&
        (!strictModeRef.current || def?.symbol)
      ) {
        onEchoRef.current?.({ type: 'insert', text: key })
        bufferRef.current.push(key)
        if (bufferRef.current.length >= MAX_BURST_CHARS) {
          flushBuffer()
        } else {
          scheduleFlush()
        }
        if (shift) releaseShiftLatch()
        return
      }

      // Special keys and modifier combos need explicit key down/up.
      flushBuffer()

      // In strict mode (and for caps in any mode), encode a capital via a
      // momentary Shift around the char so desktop modifier state stays clean.
      // Pure-text keys are echoed here too so the local preview updates even
      // when the fast-path was skipped by strict mode.
      if (isPureText(key) && !isSpecialCode(code)) {
        if (!ctrl && !alt && !meta) onEchoRef.current?.({ type: 'insert', text: key })
        if (shift || capsLockRef.current) {
          const withShift = { ...modifiersRef.current, shift: true }
          const withoutShift = { ...modifiersRef.current, shift: false }
          sendKeyEvent('key_down', code, key, withShift)
          sendKeyEvent('key_up', code, key, withoutShift)
          if (shift) releaseShiftLatch()
        } else {
          sendKeyEvent('key_down', code, key)
          sendKeyEvent('key_up', code, key)
        }
        return
      }

      if (!ctrl && !alt && !meta) {
        const token = echoToken(code)
        if (token) onEchoRef.current?.(token)
      }
      sendKeyEvent('key_down', code, key)
      sendKeyEvent('key_up', code, key)
    },
    [flushBuffer, scheduleFlush, sendKeyEvent, toggleModifier, releaseShiftLatch],
  )

  const release = useCallback(() => {}, [])

  /** Fire a shortcut chord (e.g. Ctrl+A) as a burst of key events without
   * touching the on-screen modifier latch state. Modifiers are pressed via
   * their snapshot, then released with an empty snapshot at the end. */
  const runChord = useCallback(
    (chord: Chord) => {
      if (pausedRef.current) return
      if (hapticRef.current) vibrate()
      flushBuffer()
      const mods: Modifiers = { ...initialModifiers, ...chord.mods }
      const modCode = mods.shift
        ? 'ShiftLeft'
        : mods.ctrl
          ? 'ControlLeft'
          : mods.alt
            ? 'AltLeft'
            : mods.meta
              ? 'MetaLeft'
              : null
      const modKey = modCode ? modCode.replace('Left', '') : ''
      if (modCode) {
        sendKeyEvent('key_down', modCode, modKey, mods)
      }
      sendKeyEvent('key_down', chord.key.code, chord.key.key, mods)
      sendKeyEvent('key_up', chord.key.code, chord.key.key, mods)
      if (modCode) {
        sendKeyEvent('key_up', modCode, modKey, initialModifiers)
      }
    },
    [flushBuffer, sendKeyEvent],
  )

  const clearModifiers = useCallback(() => {
    setModifiers(initialModifiers)
    setCapsLock(false)
  }, [])

  // --- Mouse control (touchpad mode) ---

  const flushMouse = useCallback(() => {
    const dx = mouseAccXRef.current
    const dy = mouseAccYRef.current
    mouseAccXRef.current = 0
    mouseAccYRef.current = 0
    if (dx === 0 && dy === 0) {
      if (mouseTimerRef.current) {
        clearInterval(mouseTimerRef.current)
        mouseTimerRef.current = null
      }
      return
    }
    sendRef.current({
      type: 'mouse',
      sessionId,
      eventId: nextEventId(),
      clientId,
      action: 'move',
      dx,
      dy,
      timestamp: new Date().toISOString(),
    })
  }, [sessionId, clientId])

  const mouseMove = useCallback(
    (dx: number, dy: number) => {
      if (pausedRef.current) return
      if (dx === 0 && dy === 0) return
      mouseAccXRef.current += dx
      mouseAccYRef.current += dy
      if (!mouseTimerRef.current) {
        mouseTimerRef.current = setInterval(flushMouse, MOUSE_MOVE_FLUSH_MS)
      }
    },
    [flushMouse],
  )

  const mouseButton = useCallback(
    (action: 'down' | 'up', button: MouseButton = 'left') => {
      if (pausedRef.current) return
      sendRef.current({
        type: 'mouse',
        sessionId,
        eventId: nextEventId(),
        clientId,
        action,
        button,
        timestamp: new Date().toISOString(),
      })
    },
    [sessionId, clientId],
  )

  const mouseScroll = useCallback(
    (delta: number, axis: 'vertical' | 'horizontal' = 'vertical') => {
      if (pausedRef.current || delta === 0) return
      sendRef.current({
        type: 'mouse',
        sessionId,
        eventId: nextEventId(),
        clientId,
        action: 'scroll',
        delta,
        axis,
        timestamp: new Date().toISOString(),
      })
    },
    [sessionId, clientId],
  )

  return {
    modifiers,
    shiftLatch: modifiers.shift,
    capsLock,
    press,
    release,
    runChord,
    clearModifiers,
    mouseMove,
    mouseButton,
    mouseScroll,
  }
}
