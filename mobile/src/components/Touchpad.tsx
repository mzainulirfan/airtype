import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { MouseButton } from '../types'

interface TouchpadProps {
  onMove: (dx: number, dy: number) => void
  onButton: (action: 'down' | 'up', button: MouseButton) => void
  onScroll: (delta: number, axis: 'vertical' | 'horizontal') => void
  /** Cursor sensitivity multiplier (also scales scroll speed). */
  sensitivity?: number
}

const MOVE_MAX_DELTA = 60
const TAP_MAX_DIST = 12
const TAP_MAX_MS = 200
const HOLD_DRAG_MS = 240
const SCROLL_THRESHOLD_PX = 18

interface PointerState {
  x: number
  y: number
  downX: number
  downY: number
  downTime: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function Touchpad({
  onMove,
  onButton,
  onScroll,
  sensitivity = 1.5,
}: TouchpadProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, PointerState>>(new Map())
  const scrollAccXRef = useRef(0)
  const scrollAccYRef = useRef(0)
  const multiFingerRef = useRef(false)
  const dragActiveRef = useRef(false)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    surfaceRef.current?.setPointerCapture(e.pointerId)
    const map = pointersRef.current
    if (map.size === 0) {
      multiFingerRef.current = false
      dragActiveRef.current = false
      scrollAccXRef.current = 0
      scrollAccYRef.current = 0
    } else {
      multiFingerRef.current = true
    }
    map.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      downX: e.clientX,
      downY: e.clientY,
      downTime: Date.now(),
    })
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    const state = map.get(e.pointerId)
    if (!state) return

    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    state.x = e.clientX
    state.y = e.clientY

    const scrolling = map.size >= 2 || (map.size === 1 && multiFingerRef.current)
    if (!scrolling) {
      // Single finger: move the cursor; holding still for a moment starts a drag.
      if (Date.now() - state.downTime >= HOLD_DRAG_MS && !dragActiveRef.current) {
        dragActiveRef.current = true
        onButton('down', 'left')
      }
      onMove(
        clamp(Math.round(dx * sensitivity), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
        clamp(Math.round(dy * sensitivity), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
      )
    } else {
      // Two fingers (or the last finger of a two-finger gesture): scroll in
      // both axes. Positive dx scrolls right, positive dy scrolls down.
      // Higher sensitivity crosses the notch threshold sooner (faster scroll).
      const threshold = Math.max(4, SCROLL_THRESHOLD_PX / sensitivity)
      scrollAccXRef.current += dx
      scrollAccYRef.current += dy
      const notchesX = Math.trunc(scrollAccXRef.current / threshold)
      const notchesY = Math.trunc(scrollAccYRef.current / threshold)
      if (notchesX !== 0) {
        scrollAccXRef.current -= notchesX * threshold
        onScroll(notchesX, 'horizontal')
      }
      if (notchesY !== 0) {
        scrollAccYRef.current -= notchesY * threshold
        onScroll(notchesY, 'vertical')
      }
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    const state = map.get(e.pointerId)
    if (!state) return
    map.delete(e.pointerId)
    if (map.size > 0) return

    const dist = Math.hypot(e.clientX - state.downX, e.clientY - state.downY)
    const dur = Date.now() - state.downTime

    if (dragActiveRef.current) {
      onButton('up', 'left')
    } else if (dur < TAP_MAX_MS && dist < TAP_MAX_DIST) {
      if (multiFingerRef.current) {
        onButton('down', 'right')
        onButton('up', 'right')
      } else {
        onButton('down', 'left')
        onButton('up', 'left')
      }
    }
    scrollAccXRef.current = 0
    scrollAccYRef.current = 0
    multiFingerRef.current = false
    dragActiveRef.current = false
  }

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    if (map.delete(e.pointerId) && map.size === 0) {
      if (dragActiveRef.current) onButton('up', 'left')
      scrollAccXRef.current = 0
      scrollAccYRef.current = 0
      multiFingerRef.current = false
      dragActiveRef.current = false
    }
  }

  return (
    <div
      ref={surfaceRef}
      className="touchpad"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="touchpad-hint">
        Geser = gerak kursor · Ketuk = klik · 2 jari = scroll/klik kanan · Tahan &amp; geser = drag
      </span>
    </div>
  )
}
