import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { MouseButton } from '../types'

interface TouchpadProps {
  onMove: (dx: number, dy: number) => void
  onButton: (action: 'down' | 'up', button: MouseButton) => void
  onScroll: (delta: number, axis: 'vertical' | 'horizontal') => void
}

const MOVE_SENSITIVITY = 1.5
const MOVE_MAX_DELTA = 60
const TAP_MAX_DIST = 10
const TAP_MAX_MS = 200
const SCROLL_THRESHOLD_PX = 18

interface PointerState {
  x: number
  y: number
  downX: number
  downY: number
  downTime: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function Touchpad({ onMove, onButton, onScroll }: TouchpadProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, PointerState>>(new Map())
  const scrollAccRef = useRef(0)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    surfaceRef.current?.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, {
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

    if (map.size === 1) {
      onMove(
        clamp(Math.round(dx * MOVE_SENSITIVITY), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
        clamp(Math.round(dy * MOVE_SENSITIVITY), -MOVE_MAX_DELTA, MOVE_MAX_DELTA),
      )
    } else if (map.size === 2) {
      // Two fingers: accumulate vertical travel, emit a scroll notch per
      // threshold crossed. Positive dy (swipe down) scrolls the page down.
      scrollAccRef.current += dy
      const notches = Math.trunc(scrollAccRef.current / SCROLL_THRESHOLD_PX)
      if (notches !== 0) {
        scrollAccRef.current -= notches * SCROLL_THRESHOLD_PX
        onScroll(notches, 'vertical')
      }
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    const state = map.get(e.pointerId)
    if (!state) return
    map.delete(e.pointerId)
    if (map.size === 0) {
      scrollAccRef.current = 0
      const dist = Math.hypot(e.clientX - state.downX, e.clientY - state.downY)
      const dur = Date.now() - state.downTime
      if (dist < TAP_MAX_DIST && dur < TAP_MAX_MS) {
        onButton('down', 'left')
        onButton('up', 'left')
      }
    }
  }

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current
    if (map.delete(e.pointerId) && map.size === 0) {
      scrollAccRef.current = 0
    }
  }

  const holdButton = (e: PointerEvent<HTMLButtonElement>, button: MouseButton) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    onButton('down', button)
  }

  const releaseButton = (button: MouseButton) => () => onButton('up', button)

  return (
    <div className="touchpad">
      <div
        ref={surfaceRef}
        className="touchpad-surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="touchpad-hint">
          Geser untuk gerakkan kursor · Ketuk = klik kiri · 2 jari = scroll
        </span>
      </div>
      <div className="touchpad-buttons">
        <button
          type="button"
          className="tpad-btn tpad-left"
          onPointerDown={(e) => holdButton(e, 'left')}
          onPointerUp={releaseButton('left')}
          onPointerCancel={releaseButton('left')}
          onContextMenu={(e) => e.preventDefault()}
        >
          Klik kiri
        </button>
        <button
          type="button"
          className="tpad-btn tpad-right"
          onPointerDown={(e) => holdButton(e, 'right')}
          onPointerUp={releaseButton('right')}
          onPointerCancel={releaseButton('right')}
          onContextMenu={(e) => e.preventDefault()}
        >
          Klik kanan
        </button>
      </div>
    </div>
  )
}
