import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getChannelName } from '../lib/supabase'
import type { BroadcastPayload, ConnectionStatus } from '../types'

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
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const statusRef = useRef<ConnectionStatus>('disconnected')
  const onMessageRef = useRef(onMessage)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stuckSinceRef = useRef(0)
  const activeRef = useRef<string | null>(null)
  const hiddenSinceRef = useRef(0)
  const lastDesktopAtRef = useRef(0)
  const reconnectRef = useRef<() => void>(() => {})

  onMessageRef.current = onMessage

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
    setBoth('connecting')

    const presence = (type: 'client_joined' | 'client_left' | 'client_heartbeat') => ({
      type,
      eventId: nextPresenceId(clientId),
      sessionId,
      clientId,
      timestamp: new Date().toISOString(),
    })

    // The channel's send() throws synchronously when the channel is not
    // joined yet (it can happen briefly during reconnects). Never let that
    // escape into event handlers or the heartbeat timer.
    const safeSend = (payload: BroadcastPayload) => {
      const ch = channelRef.current
      if (!ch) return
      try {
        ch.send({ type: 'broadcast', event: 'airtype', payload }).catch(() => {})
      } catch {
        /* channel not joined — ignore */
      }
    }

    const subscribeCb = (state: string) => {
      if (activeRef.current !== channelName) return
      if (state === 'SUBSCRIBED') {
        setBoth('connected')
        safeSend(presence('client_joined'))
        if (presenceTimerRef.current) clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = setInterval(() => {
          if (activeRef.current !== channelName) return
          safeSend(presence('client_heartbeat'))
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
          const p = payload as BroadcastPayload
          // The desktop broadcasts its status periodically; treat any inbound
          // desktop_status as proof the link is still alive end-to-end.
          if (p.type === 'desktop_status') lastDesktopAtRef.current = Date.now()
          onMessageRef.current(p)
        })
        .subscribe(subscribeCb)
      channelRef.current = channel
    }

    const teardownChannel = (sendLeft: boolean) => {
      if (presenceTimerRef.current) {
        clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = null
      }
      if (sendLeft) {
        safeSend(presence('client_left'))
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
      safeSend(presence('client_joined'))
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
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(checkTimer)
      teardownChannel(true)
    }
  }, [client, sessionId, clientId, setBoth])

  const send = useCallback(
    (payload: BroadcastPayload) => {
      if (!client || !sessionId || !channelRef.current) return false
      const markReconnecting = () => setBoth('reconnecting')
      try {
        channelRef.current
          .send({
            type: 'broadcast',
            event: 'airtype',
            payload,
          })
          .then((res) => {
            if (res === 'error' || res === 'timed out') markReconnecting()
          })
          .catch(markReconnecting)
      } catch {
        markReconnecting()
      }
      return true
    },
    [client, sessionId, setBoth],
  )

  const reconnect = useCallback(() => {
    reconnectRef.current()
  }, [])

  return { status, send, reconnect }
}
