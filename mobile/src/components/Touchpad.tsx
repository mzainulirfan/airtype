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
const EDGE_X = 60
const EDGE_Y = 48

type EdgeScroll = 'v' | 'h' | null

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
  const edgeScrollRef = useRef<EdgeScroll>(null)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    surfaceRef.current?.setPointerCapture(e.pointerId)
    const map = pointersRef.current
    if (map.size === 0) {
      multiFingerRef.current = false
      dragActiveRef.current = false
      scrollAccXRef.current = 0
      scrollAccYRef.current = 0
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x >= rect.width - EDGE_X) {
        edgeScrollRef.current = 'v'
      } else if (y >= rect.height - EDGE_Y) {
        edgeScrollRef.current = 'h'
      } else {
        edgeScrollRef.current = null
      }
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

  /** Turn accumulated finger travel into scroll notches in both axes. */
  const emitScroll = (dx: number, dy: number) => {
    const threshold = Math.max(4, SCROLL_THRESHOLD_PX / sensitivity)
    scrollAccXRef.current += dx
    scrollAccYRef.current += dy
    const nx = Math.trunc(scrollAccXRef.current / threshold)
    const ny = Math.trunc(scrollAccYRef.current / threshold)
    if (nx !== 0) {
      scrollAccXRef.current -= nx * threshold
      onScroll(nx, 'horizontal')
    }
    if (ny !== 0) {
      scrollAccYRef.current -= ny * threshold
      onScroll(ny, 'vertical')
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    const state = map.get(e.pointerId)
    if (!state) return

    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    state.x = e.clientX
    state.y = e.clientY

    if (map.size >= 2 || multiFingerRef.current) {
      // Two fingers (or the last finger of a two-finger gesture): scroll in
      // both axes.
      emitScroll(dx, dy)
      return
    }

    const edge = edgeScrollRef.current
    if (edge === 'v') {
      emitScroll(0, dy)
      return
    }
    if (edge === 'h') {
      emitScroll(dx, 0)
      return
    }

    // Center: move the cursor; holding still for a moment starts a drag.
    if (Date.now() - state.downTime >= HOLD_DRAG_MS && !dragActiveRef.current) {
      dragActiveRef.current = true
      onButton('down', 'left')
    }
    onMove(
      clamp(Math.round(dx * sensitivity), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
      clamp(Math.round(dy * sensitivity), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
    )
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
    edgeScrollRef.current = null
  }

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    if (map.delete(e.pointerId) && map.size === 0) {
      if (dragActiveRef.current) onButton('up', 'left')
      scrollAccXRef.current = 0
      scrollAccYRef.current = 0
      multiFingerRef.current = false
      dragActiveRef.current = false
      edgeScrollRef.current = null
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
        Geser = kursor · Ketuk = klik · 2 jari = scroll/klik kanan · Tahan = drag
      </span>
      <span className="touchpad-edge v" aria-hidden="true">
        Scroll
      </span>
      <span className="touchpad-edge h" aria-hidden="true">
        Scroll
      </span>
    </div>
  )
}
