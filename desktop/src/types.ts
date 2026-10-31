export type Status =
  | 'idle'
  | 'creating_session'
  | 'subscribing'
  | 'waiting_pairing'
  | 'waiting_approval'
  | 'connected'
  | 'paused'
  | 'reconnecting'

export interface HistoryItem {
  id: string
  kind: string
  code: string | null
  text: string | null
  action: string | null
  receivedAt: string
  simulated: boolean
}

export interface SessionInfo {
  sessionId: string
  channel: string
  pairingUrl: string
}

export interface ClientInfo {
  clientId: string
  connectedAtMs: number
  approximate: boolean
}

export interface PendingClient {
  clientId: string
  requestedAtMs: number
}

export interface Stats {
  chars: number
  keyEvents: number
  mouseEvents: number
  errors: number
  lastActivityMs: number | null
}

export interface UiSnapshot {
  session: SessionInfo
  presence: string
  paused: boolean
  client: ClientInfo | null
  pending: PendingClient | null
  stats: Stats
  history: HistoryItem[]
  hostname: string
  autoPauseAfterMs: number
  historyEnabled: boolean
}

export type Unlisten = () => void

/** Minimal surface shared by the Tauri API and the dev-only demo adapter. */
export interface Bridge {
  listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<Unlisten>
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}
