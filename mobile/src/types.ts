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

export type BroadcastPayload = KeyEventPayload | TypeTextPayload

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface SessionInfo {
  sessionId: string
  channel: string
}
