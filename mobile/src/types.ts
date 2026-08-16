export interface Modifiers {
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
}

export type KeyEventType = 'key_down' | 'key_up'

export interface KeyEventPayload {
  type: KeyEventType
  sessionId: string
  eventId: string
  clientId: string
  code: string
  key: string
  modifiers: Modifiers
  timestamp: string
}

export interface TypeTextPayload {
  type: 'type_text'
  sessionId: string
  eventId: string
  clientId: string
  text: string
  timestamp: string
}

export type MouseAction = 'move' | 'down' | 'up' | 'scroll'
export type MouseButton = 'left' | 'right' | 'middle'

export interface MouseEventPayload {
  type: 'mouse'
  sessionId: string
  eventId: string
  clientId: string
  action: MouseAction
  button?: MouseButton
  dx?: number
  dy?: number
  delta?: number
  axis?: 'vertical' | 'horizontal'
  timestamp: string
}

export type BroadcastPayload =
  | KeyEventPayload
  | TypeTextPayload
  | MouseEventPayload
  | DesktopStatusPayload
  | PresencePayload

/** Local echo of what would appear on the PC, for the on-screen preview. */
export type EchoToken =
  | { type: 'insert'; text: string }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'enter' }
  | { type: 'tab' }

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/** Trackpad multi-finger gestures. 3-finger gestures are intentionally not
 * used: Android/iOS reserve them for system actions (screenshot/VoiceOver). */
export type GestureName =
  | 'back'
  | 'forward'
  | 'task_view'
  | 'zoom_in'
  | 'zoom_out'

export interface DesktopStatusPayload {
  type: 'desktop_status'
  eventId: string
  sessionId: string
  status: 'waiting_pairing' | 'connected' | 'paused'
  deviceName?: string
  timestamp: string
}

export interface PresencePayload {
  type: 'client_joined' | 'client_left' | 'client_heartbeat'
  eventId: string
  sessionId: string
  clientId: string
  timestamp: string
}

export interface SessionInfo {
  sessionId: string
  channel: string
}
