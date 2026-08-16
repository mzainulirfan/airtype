import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { GestureName, MouseButton } from '../types'

interface TouchpadProps {
  onMove: (dx: number, dy: number) => void
  onButton: (action: 'down' | 'up', button: MouseButton) => void
  onScroll: (delta: number, axis: 'vertical' | 'horizontal') => void
  /** Cursor sensitivity multiplier (also scales scroll speed). */
  sensitivity?: number
  /** Opens the gesture guide sheet. */
  onHelp?: () => void
  /** Fires MacBook-style multi-finger gestures (2/3-finger swipe, pinch). */
  onGesture?: (gesture: GestureName) => void
}

const MOVE_MAX_DELTA = 100
const TAP_MAX_DIST = 12
const TAP_MAX_MS = 200
const HOLD_DRAG_MS = 240
const HOLD_STILL_RADIUS = 10
const SCROLL_THRESHOLD_PX = 18
const EDGE_X = 60
const EDGE_Y = 48
// Cumulative finger travel (actual px) to commit a swipe gesture.
const SWIPE_THRESHOLD_PX = 60
// Finger-distance change to emit one pinch (zoom) notch.
const PINCH_THRESHOLD_PX = 24
// Window in which a second 2-finger tap becomes a task-view gesture.
const DOUBLE_TAP_2F_MS = 300

type EdgeScroll = 'v' | 'h' | null
type TwoFingerMode = 'none' | 'pinch' | 'pan'

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
  onHelp,
  onGesture,
}: TouchpadProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, PointerState>>(new Map())
  const scrollAccXRef = useRef(0)
  const scrollAccYRef = useRef(0)
  const multiFingerRef = useRef(false)
  const dragActiveRef = useRef(false)
  const edgeScrollRef = useRef<EdgeScroll>(null)
  const maxFingersRef = useRef(0)
  const twoFingerModeRef = useRef<TwoFingerMode>('none')
  const pinchStartDistRef = useRef(0)
  const panXRef = useRef(0)
  const panYRef = useRef(0)
  const gestureLockedRef = useRef(false)
  const gestureFiredRef = useRef(false)
  const last2TapRef = useRef(0)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    surfaceRef.current?.setPointerCapture(e.pointerId)
    const map = pointersRef.current
    if (map.size === 0) {
      multiFingerRef.current = false
      dragActiveRef.current = false
      scrollAccXRef.current = 0
      scrollAccYRef.current = 0
      maxFingersRef.current = 0
      twoFingerModeRef.current = 'none'
      pinchStartDistRef.current = 0
      panXRef.current = 0
      panYRef.current = 0
      gestureLockedRef.current = false
      gestureFiredRef.current = false
      last2TapRef.current = 0
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
    maxFingersRef.current = Math.max(maxFingersRef.current, map.size)
    if (map.size === 2) {
      const [a, b] = [...map.values()]
      pinchStartDistRef.current = Math.hypot(b.x - a.x, b.y - a.y)
    }
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
    if (nx !== 0 || ny !== 0) gestureFiredRef.current = true
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    const state = map.get(e.pointerId)
    if (!state) return

    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    state.x = e.clientX
    state.y = e.clientY

    if (map.size === 1 && !multiFingerRef.current) {
      const edge = edgeScrollRef.current
      if (edge === 'v') {
        emitScroll(0, dy)
        return
      }
      if (edge === 'h') {
        emitScroll(dx, 0)
        return
      }

      // Center: move the cursor. A drag only starts when the finger was held
      // still for a moment — never while actually moving, otherwise ordinary
      // cursor moves over text would start a drag and select everything.
      const distFromDown = Math.hypot(e.clientX - state.downX, e.clientY - state.downY)
      if (
        Date.now() - state.downTime >= HOLD_DRAG_MS &&
        !dragActiveRef.current &&
        distFromDown < HOLD_STILL_RADIUS
      ) {
        dragActiveRef.current = true
        onButton('down', 'left')
      }
      // Mild acceleration: faster finger travel moves the cursor further, so
      // long flicks cover distance without a sluggish feel.
      const speed = Math.hypot(dx, dy)
      const accel = speed > 8 ? 1 + Math.min(1, (speed - 8) / 40) : 1
      const gain = sensitivity * accel
      onMove(
        clamp(Math.round(dx * gain), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
        clamp(Math.round(dy * gain), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
      )
      return
    }

    if (gestureLockedRef.current) return

    // Only two-finger gestures are supported: 3-finger gestures are captured
    // by the OS on Android/iOS (screenshot/VoiceOver) and never reach the app.
    if (map.size !== 2) return

    const [a, b] = [...map.values()]
    if (twoFingerModeRef.current === 'none') {
      // Fingers moving towards/away from each other => pinch (zoom);
      // moving in the same direction => pan (scroll / horizontal swipe).
      const v1x = a.x - a.downX
      const v1y = a.y - a.downY
      const v2x = b.x - b.downX
      const v2y = b.y - b.downY
      if (v1x !== 0 || v1y !== 0 || v2x !== 0 || v2y !== 0) {
        twoFingerModeRef.current = v1x * v2x + v1y * v2y < 0 ? 'pinch' : 'pan'
      }
    }
    if (twoFingerModeRef.current === 'pinch') {
      const cur = Math.hypot(b.x - a.x, b.y - a.y)
      const change = cur - pinchStartDistRef.current
      if (Math.abs(change) >= PINCH_THRESHOLD_PX) {
        pinchStartDistRef.current = cur
        gestureFiredRef.current = true
        onGesture?.(change > 0 ? 'zoom_in' : 'zoom_out')
      }
      return
    }

    // Pan: keep the dominant axis. Vertical = scroll; horizontal past the
    // swipe threshold = browser back/forward.
    panXRef.current += dx / 2
    panYRef.current += dy / 2
    const ax = Math.abs(panXRef.current)
    const ay = Math.abs(panYRef.current)
    if (ay > ax) {
      panXRef.current = 0
      emitScroll(0, dy)
    } else {
      panYRef.current = 0
      if (ax > SWIPE_THRESHOLD_PX) {
        gestureLockedRef.current = true
        gestureFiredRef.current = true
        onGesture?.(panXRef.current > 0 ? 'forward' : 'back')
      } else {
        emitScroll(dx, 0)
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
    } else if (!gestureFiredRef.current && dur < TAP_MAX_MS && dist < TAP_MAX_DIST) {
      const fingers = maxFingersRef.current
      if (fingers >= 2) {
        // Two quick 2-finger taps = task view; a single one = right click.
        const now = Date.now()
        if (now - last2TapRef.current < DOUBLE_TAP_2F_MS) {
          last2TapRef.current = 0
          onGesture?.('task_view')
        } else {
          last2TapRef.current = now
          onButton('down', 'right')
          onButton('up', 'right')
        }
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
    gestureLockedRef.current = false
    gestureFiredRef.current = false
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
      gestureLockedRef.current = false
      gestureFiredRef.current = false
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
        1 jari: cursor · 2 jari: scroll · cubit: zoom
      </span>
      {onHelp && (
        <button
          type="button"
          className="touchpad-help"
          aria-label="Cara menggunakan touchpad"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onHelp}
        >
          ?
        </button>
      )}
    </div>
  )
}