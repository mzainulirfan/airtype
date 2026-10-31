import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getChannelName } from '../lib/supabase'
import { decryptEnvelope, encryptPayload, isEncryptedEnvelope } from '../lib/crypto'
import type { BroadcastPayload, ConnectionStatus, EncryptedEnvelope } from '../types'

export interface RealtimeOptions {
  sessionId: string
  onMessage: (event: BroadcastPayload) => void
}

const PRESENCE_HEARTBEAT_MS = 15000
const RECONNECT_CHECK_MS = 15000
const STUCK_AFTER_MS = 30000
// If the tab was hidden at least this long, the socket is likely stale/dead
// (browser suspends JS timers while backgrounded), so force a fresh subscribe.
const HIDDEN_RESUBSCRIBE_MS = 15000
// If we are "connected" (channel SUBSCRIBED) but have not heard a single
// desktop_status broadcast for this long, the socket is half-open and the
// link is dead even though nothing reports an error. Force a fresh subscribe.
// The desktop broadcasts desktop_status every ~10s, so this is several missed
// broadcasts of slack.
const DESKTOP_STALE_AFTER_MS = 40000
// No desktop signal at all for this long means the pairing is dead (session
// rotated, desktop crashed or uninstalled): stop reconnecting forever and let
// the user pair again.
const DESKTOP_EXPIRED_AFTER_MS = 90000

const TAB_STORAGE_KEY = 'airtype_tab_id'

function loadTabId(): string {
  try {
    const stored = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (stored) return stored
  } catch {
    /* storage unavailable */
  }
  const random =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const id = `tab-${random.slice(0, 12)}`
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, id)
  } catch {
    /* storage unavailable */
  }
  return id
}

const TAB_ID = loadTabId()

let presenceCounter = 0

function nextPresenceId(clientId: string): string {
  presenceCounter += 1
  return `pres-${clientId}-${presenceCounter}-${Date.now().toString(36)}`
}

export function useRealtime(
  client: SupabaseClient | null,
  sessionId: string | null,
  clientId: string,
  onMessage: (event: BroadcastPayload) => void,
  onExpired?: () => void,
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const statusRef = useRef<ConnectionStatus>('disconnected')
  const onMessageRef = useRef(onMessage)
  const onExpiredRef = useRef(onExpired)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stuckSinceRef = useRef(0)
  const activeRef = useRef<string | null>(null)
  const hiddenSinceRef = useRef(0)
  const lastDesktopAtRef = useRef(0)
  const reconnectRef = useRef<() => void>(() => {})
  const sendRef = useRef<(payload: BroadcastPayload) => void>(() => {})
  // Set once the desktop advertises E2E support. Old desktops never do, so
  // the phone keeps sending plaintext to stay compatible with them.
  const secureRef = useRef(false)
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve())
  const inboundQueueRef = useRef<Promise<void>>(Promise.resolve())

  onMessageRef.current = onMessage
  onExpiredRef.current = onExpired

  const setBoth = useCallback((next: ConnectionStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  useEffect(() => {
    if (!client || !sessionId) {
      setBoth('disconnected')
      return
    }

    const channelName = getChannelName(sessionId)
    activeRef.current = channelName
    secureRef.current = false
    // Start the dead-pairing clock now, otherwise a stale stored session would
    // reconnect forever without ever expiring.
    lastDesktopAtRef.current = Date.now()
    let expired = false
    setBoth('connecting')

    const presence = (type: 'client_joined' | 'client_left' | 'client_heartbeat') => ({
      type,
      eventId: nextPresenceId(clientId),
      sessionId,
      clientId,
      tabId: TAB_ID,
      timestamp: new Date().toISOString(),
    })

    // Outbound sends are serialized so encryption never reorders messages
    // (keystrokes must reach the desktop in the order they were typed).
    // Encryption is opportunistic: until the desktop advertises E2E we send
    // plaintext so older desktop builds keep working.
    const queueSend = (payload: BroadcastPayload) => {
      const ch = channelRef.current
      if (!ch) return
      sendQueueRef.current = sendQueueRef.current.then(async () => {
        let wire: BroadcastPayload | EncryptedEnvelope = payload
        if (secureRef.current) {
          try {
            wire = await encryptPayload(sessionId, payload)
          } catch {
            // crypto.subtle is unavailable outside secure contexts; falling
            // back to plaintext keeps the remote usable instead of dead.
            wire = payload
          }
        }
        try {
          await ch.send({ type: 'broadcast', event: 'airtype', payload: wire })
        } catch {
          /* channel closed — nothing to do */
        }
      })
    }
    sendRef.current = queueSend

    const dispatch = (payload: BroadcastPayload) => {
      // The desktop broadcasts its status periodically; treat any inbound
      // desktop_status as proof the link is still alive end-to-end.
      if (payload.type === 'desktop_status') {
        if (payload.e2e === 1) secureRef.current = true
        lastDesktopAtRef.current = Date.now()
      }
      onMessageRef.current(payload)
    }

    const queueInbound = (payload: unknown) => {
      inboundQueueRef.current = inboundQueueRef.current.then(async () => {
        if (isEncryptedEnvelope(payload)) {
          const decrypted = await decryptEnvelope(sessionId, payload)
          if (!decrypted) return
          secureRef.current = true
          dispatch(decrypted)
          return
        }
        if (payload && typeof payload === 'object') {
          dispatch(payload as BroadcastPayload)
        }
      })
    }

    const joinNow = () => {
      queueSend(presence('client_joined'))
    }
    const heartbeatNow = () => {
      queueSend(presence('client_heartbeat'))
    }

    const subscribeCb = (state: string) => {
      if (activeRef.current !== channelName) return
      if (state === 'SUBSCRIBED') {
        setBoth('connected')
        joinNow()
        if (presenceTimerRef.current) clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = setInterval(() => {
          if (activeRef.current !== channelName) return
          heartbeatNow()
        }, PRESENCE_HEARTBEAT_MS)
      } else {
        setBoth('reconnecting')
      }
    }

    const setupChannel = () => {
      const channel = client
        .channel(channelName, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'airtype' }, ({ payload }) => {
          queueInbound(payload)
        })
        .subscribe(subscribeCb)
      channelRef.current = channel
    }

    const teardownChannel = (sendLeft: boolean) => {
      if (presenceTimerRef.current) {
        clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = null
      }
      if (sendLeft && channelRef.current) {
        // Presence carries no content, so it goes out immediately and in the
        // clear; the async send queue would lose the race with removeChannel.
        try {
          channelRef.current
            .send({ type: 'broadcast', event: 'airtype', payload: presence('client_left') })
            .catch(() => {})
        } catch {
          /* channel not joined — ignore */
        }
      }
      if (channelRef.current) {
        client.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }

    // Re-subscribe from scratch when the channel is stuck or missing.
    const hardReconnect = () => {
      if (activeRef.current !== channelName) return
      teardownChannel(false)
      setBoth('connecting')
      setupChannel()
    }
    reconnectRef.current = hardReconnect

    const rehandshake = () => {
      if (!channelRef.current || statusRef.current !== 'connected') {
        hardReconnect()
        return
      }
      joinNow()
    }

    // Returning to the foreground: re-handshake with the desktop right away
    // (it may have flipped to waiting_pairing while we were backgrounded).
    // If the tab was hidden for a while, the old socket is likely stale/dead
    // and a light rehandshake would be silently lost; force a fresh subscribe
    // so the desktop receives a real client_joined and resumes.
    const onVisibility = () => {
      if (activeRef.current !== channelName) return
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now()
        return
      }
      if (Date.now() - hiddenSinceRef.current >= HIDDEN_RESUBSCRIBE_MS) {
        hardReconnect()
      } else {
        rehandshake()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Network came back (WiFi/cellular switch): reconnect immediately instead
    // of waiting for the socket timeout.
    const onOnline = () => {
      if (activeRef.current !== channelName) return
      rehandshake()
    }
    // Network dropped: stop pretending we are connected.
    const onOffline = () => {
      if (activeRef.current !== channelName) return
      setBoth('reconnecting')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Safety net: if we have been disconnected for too long, force a clean
    // re-subscribe instead of relying solely on the library's reconnect.
    const checkTimer = setInterval(() => {
      if (activeRef.current !== channelName) return
      if (statusRef.current === 'connected') {
        stuckSinceRef.current = 0
        // End-to-end liveness: a healthy link has a desktop_status arriving
        // every ~10s. If none has arrived while the channel still reports
        // SUBSCRIBED, the socket is half-open: commands are silently lost but
        // nothing raises an error. Surface it and force a fresh subscribe.
        if (Date.now() - lastDesktopAtRef.current > DESKTOP_STALE_AFTER_MS) {
          setBoth('reconnecting')
          hardReconnect()
        }
        return
      }
      // The pairing is dead, not merely slow: return to the pairing screen
      // instead of reconnecting forever to a session nobody is serving.
      if (!expired && Date.now() - lastDesktopAtRef.current > DESKTOP_EXPIRED_AFTER_MS) {
        expired = true
        setBoth('disconnected')
        onExpiredRef.current?.()
        return
      }
      if (stuckSinceRef.current === 0) {
        stuckSinceRef.current = Date.now()
      } else if (Date.now() - stuckSinceRef.current > STUCK_AFTER_MS) {
        stuckSinceRef.current = 0
        hardReconnect()
      }
    }, RECONNECT_CHECK_MS)

    setupChannel()

    return () => {
      activeRef.current = null
      reconnectRef.current = () => {}
      sendRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(checkTimer)
      teardownChannel(true)
    }
  }, [client, sessionId, clientId, setBoth])

  const send = useCallback((payload: BroadcastPayload) => {
    if (!client || !sessionId || !channelRef.current) return false
    sendRef.current(payload)
    return true
  }, [client, sessionId])

  const reconnect = useCallback(() => {
    reconnectRef.current()
  }, [])

  return { status, send, reconnect }
}
