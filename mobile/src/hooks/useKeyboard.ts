import { useCallback, useEffect, useRef, useState } from 'react'
import type { BroadcastPayload, KeyEventPayload, Modifiers } from '../types'
import { isModifierCode, isPureText, vibrate } from '../lib/keys'

export interface KeyboardOptions {
  sessionId: string
  clientId: string
  send: (payload: BroadcastPayload) => boolean
  textBurstMs?: number
  paused?: boolean
  onLatency?: (ms: number) => void
}

let eventCounter = 0

function nextEventId(): string {
  eventCounter += 1
  return `evt-${eventCounter}-${Date.now().toString(36)}`
}

const initialModifiers: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

export function useKeyboard({
  sessionId,
  clientId,
  send,
  textBurstMs = 80,
  paused = false,
  onLatency,
}: KeyboardOptions) {
  const [modifiers, setModifiers] = useState<Modifiers>(initialModifiers)
  const [capsLock, setCapsLock] = useState(false)
  const modifiersRef = useRef(modifiers)
  modifiersRef.current = modifiers

  const bufferRef = useRef<string[]>([])
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendRef = useRef(send)
  const pausedRef = useRef(paused)
  sendRef.current = send
  pausedRef.current = paused

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
      vibrate()

      if (isModifierCode(code) || code === 'CapsLock') {
        toggleModifier(code, key)
        return
      }

      const { shift, ctrl, alt, meta } = modifiersRef.current

      // Fast-path: pure text, without ctrl/alt/meta, can be bundled as type_text.
      // Shift is safe here because the label already encodes the shift.
      if (isPureText(key) && !ctrl && !alt && !meta) {
        bufferRef.current.push(key)
        scheduleFlush()
        if (shift) releaseShiftLatch()
        return
      }

      // Special keys and modifier combos need explicit key down/up.
      flushBuffer()
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
