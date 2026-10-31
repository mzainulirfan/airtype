import type {
  Bridge,
  ClientInfo,
  HistoryItem,
  SessionInfo,
  Stats,
  UiSnapshot,
} from './types'

/**
 * Dev-only preview adapter (`npm run dev` + `?demo=pairing|connected|paused|empty`).
 * It is loaded through a dynamic import behind `import.meta.env.DEV`, so it is
 * never bundled into the production build.
 */

const HOSTNAME = 'ZANAF-PC'
const SESSION_ID = '7f3a9c2e4b6d8f0a1c3e5b7d9f2a4c6e'

const emptyStats = (): Stats => ({
  chars: 0,
  keyEvents: 0,
  mouseEvents: 0,
  errors: 0,
  lastActivityMs: null,
})

function session(id = SESSION_ID): SessionInfo {
  return {
    sessionId: id,
    channel: `airtype:session:${id}`,
    pairingUrl: `https://airtype-snowy.vercel.app/connect?session=${id}`,
  }
}

function historyItem(
  secondsAgo: number,
  item: Partial<HistoryItem> & Pick<HistoryItem, 'kind'>,
): HistoryItem {
  return {
    id: `demo-${secondsAgo}-${Math.random().toString(16).slice(2, 8)}`,
    code: null,
    text: null,
    action: null,
    simulated: true,
    receivedAt: String(Date.now() - secondsAgo * 1000),
    ...item,
  }
}

function connectedClient(): ClientInfo {
  return {
    clientId: 'a91f3c7d2e',
    connectedAtMs: Date.now() - 12 * 60 * 1000,
    approximate: false,
  }
}

export function createDemoBridge(mode: string): Bridge {
  const listeners = new Map<string, Set<(event: { payload: unknown }) => void>>()
  const emit = (event: string, payload: unknown) => {
    listeners.get(event)?.forEach((handler) => handler({ payload }))
  }

  let state: UiSnapshot = {
    session: session(),
    presence: 'waiting_pairing',
    paused: false,
    client: null,
    pending: null,
    stats: emptyStats(),
    history: [],
    hostname: HOSTNAME,
    autoPauseAfterMs: 60_000,
    historyEnabled: true,
  }

  if (mode === 'approval') {
    state = {
      ...state,
      presence: 'waiting_approval',
      pending: {
        clientId: 'mobile-9f2c1a7b4d3e5061',
        requestedAtMs: Date.now() - 4200,
      },
    }
  } else if (mode === 'connected' || mode === 'paused') {
    state = {
      ...state,
      presence: mode === 'paused' ? 'paused' : 'connected',
      paused: mode === 'paused',
      client: connectedClient(),
      stats: {
        chars: 1284,
        keyEvents: 342,
        mouseEvents: 57,
        errors: 1,
        lastActivityMs: Date.now() - 6000,
      },
      history: [
        historyItem(6, { kind: 'type_text', text: 'Halo, ini diketik dari HP.' }),
        historyItem(12, { kind: 'key_down', code: 'Enter' }),
        historyItem(34, { kind: 'mouse', action: 'down' }),
        historyItem(51, { kind: 'key_down', code: 'KeyA' }),
        historyItem(83, { kind: 'mouse', action: 'scroll' }),
        historyItem(120, {
          kind: 'key_down',
          code: 'PageDown',
          simulated: false,
        }),
        historyItem(180, { kind: 'type_text', text: 'npm run dev' }),
      ],
    }
  } else if (mode === 'empty') {
    state = {
      ...state,
      presence: 'connected',
      client: connectedClient(),
      stats: { ...emptyStats(), lastActivityMs: null },
    }
  }

  return {
    async listen(event, handler) {
      let set = listeners.get(event)
      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(handler as (event: { payload: unknown }) => void)
      return () => {
        set?.delete(handler as (event: { payload: unknown }) => void)
      }
    },

    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      switch (command) {
        case 'init_app':
          return undefined as T
        case 'get_ui_snapshot':
          return structuredClone(state) as T
        case 'clear_history':
          state.history = []
          emit('airtype:history', state.history)
          return undefined as T
        case 'resolve_pairing': {
          const pending = state.pending
          if (!pending) return undefined as T
          const approve = args?.approve === true
          state.pending = null
          emit('airtype:pending', null)
          if (approve) {
            state.client = {
              clientId: pending.clientId,
              connectedAtMs: Date.now(),
              approximate: false,
            }
            state.presence = 'connected'
            emit('airtype:client', state.client)
            emit('airtype:status', 'connected')
          } else {
            state.presence = 'waiting_pairing'
            emit('airtype:status', 'waiting_pairing')
          }
          return undefined as T
        }
        case 'toggle_pause': {
          state.paused = !state.paused
          state.presence = state.paused ? 'paused' : 'connected'
          emit('airtype:status', state.presence)
          return state.paused as T
        }
        case 'set_auto_pause': {
          state.autoPauseAfterMs = Number(args?.timeoutMs) || 0
          return undefined as T
        }
        case 'new_session': {
          const id = Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
            (b) => b.toString(16).padStart(2, '0'),
          ).join('')
          state = {
            ...state,
            session: session(id),
            presence: 'waiting_pairing',
            paused: false,
            client: null,
            stats: emptyStats(),
            history: [],
          }
          emit('airtype:client', null)
          emit('airtype:stats', state.stats)
          emit('airtype:history', state.history)
          emit('airtype:status', 'waiting_pairing')
          return state.session as T
        }
        default:
          throw new Error(`demo: perintah "${command}" tidak dikenal`)
      }
    },
  }
}
