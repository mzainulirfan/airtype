import { useCallback, useEffect, useRef, useState } from 'react'
import type { BroadcastPayload, KeyEventPayload, Modifiers } from '../types'
import { isModifierCode, isPureText, isSpecialCode, vibrate } from '../lib/keys'

export interface KeyboardOptions {
  sessionId: string
  clientId: string
  send: (payload: BroadcastPayload) => boolean
  textBurstMs?: number
  paused?: boolean
  haptic?: boolean
  strictMode?: boolean
  onLatency?: (ms: number) => void
  /** Local echo of what would appear on the PC, for the on-screen preview.
   * '\b' = backspace, '\n' = enter, '\t' = tab, otherwise a printable char. */
  onEcho?: (token: string) => void
}

let eventCounter = 0

function nextEventId(): string {
  eventCounter += 1
  return `evt-${eventCounter}-${Date.now().toString(36)}`
}

const initialModifiers: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

const MAX_BURST_CHARS = 12

/** Map a non-text special key to its preview token. Only for keys that
 * visibly change the typed text (space/enter/tab/backspace); others are null. */
function echoToken(code: string, key: string): string | null {
  switch (code) {
    case 'Space':
      return ' '
    case 'Enter':
    case 'NumpadEnter':
      return '\n'
    case 'Tab':
      return '\t'
    case 'Backspace':
      return '\b'
    default:
      return isPureText(key) && !isSpecialCode(code) ? key : null
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
      let active: boolean
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        next.shift = !next.shift
        active = next.shift
      } else if (code === 'ControlLeft' || code === 'ControlRight') {
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
    (code: string, key: string) => {
      if (pausedRef.current) return
      if (hapticRef.current) vibrate()

      if (isModifierCode(code) || code === 'CapsLock') {
        toggleModifier(code, key)
        return
      }

      const { shift, ctrl, alt, meta } = modifiersRef.current

      // Fast-path: pure text, without ctrl/alt/meta, can be bundled as type_text.
      // Shift is safe here because the label already encodes the shift.
      if (isPureText(key) && !isSpecialCode(code) && !ctrl && !alt && !meta && !strictModeRef.current) {
        onEchoRef.current?.(key)
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
      if (isPureText(key) && !isSpecialCode(code) && (shift || capsLockRef.current)) {
        if (!ctrl && !alt && !meta) onEchoRef.current?.(key)
        const withShift = { ...modifiersRef.current, shift: true }
        const withoutShift = { ...modifiersRef.current, shift: false }
        sendKeyEvent('key_down', code, key, withShift)
        sendKeyEvent('key_up', code, key, withoutShift)
        if (shift) releaseShiftLatch()
        return
      }

      if (!ctrl && !alt && !meta) {
        const token = echoToken(code, key)
        if (token) onEchoRef.current?.(token)
      }
      sendKeyEvent('key_down', code, key)
      sendKeyEvent('key_up', code, key)
    },
    [flushBuffer, scheduleFlush, sendKeyEvent, toggleModifier, releaseShiftLatch],
  )

  const release = useCallback(() => {}, [])

  const clearModifiers = useCallback(() => {
    setModifiers(initialModifiers)
    setCapsLock(false)
  }, [])

  return { modifiers, shiftLatch: modifiers.shift, capsLock, press, release, clearModifiers }
}
