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
          onMessageRef.current(payload as BroadcastPayload)
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

    const rehandshake = () => {
      if (!channelRef.current || statusRef.current !== 'connected') {
        hardReconnect()
        return
      }
      safeSend(presence('client_joined'))
    }

    // Returning to the foreground: re-handshake with the desktop right away
    // (it may have flipped to waiting_pairing while we were backgrounded),
    // or hard-reconnect if we lost the link while away.
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (activeRef.current !== channelName) return
      rehandshake()
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

  return { status, send }
}
