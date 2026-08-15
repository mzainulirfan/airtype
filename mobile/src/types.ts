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

export type BroadcastPayload = KeyEventPayload | TypeTextPayload | DesktopStatusPayload | PresencePayload

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface DesktopStatusPayload {
  type: 'desktop_status'
  eventId: string
  sessionId: string
  status: 'waiting_pairing' | 'connected' | 'paused'
  timestamp: string
}

export interface PresencePayload {
  type: 'client_joined' | 'client_left'
  eventId: string
  sessionId: string
  clientId: string
  timestamp: string
}

export interface SessionInfo {
  sessionId: string
  channel: string
}
