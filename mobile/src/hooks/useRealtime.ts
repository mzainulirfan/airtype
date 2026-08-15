import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getChannelName } from '../lib/supabase'
import type { BroadcastPayload, ConnectionStatus } from '../types'

export interface RealtimeOptions {
  sessionId: string
  onMessage: (event: BroadcastPayload) => void
}

const PRESENCE_HEARTBEAT_MS = 15000

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
  const onMessageRef = useRef(onMessage)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef = useRef<string | null>(null)

  onMessageRef.current = onMessage

  useEffect(() => {
    if (!client || !sessionId) {
      setStatus('disconnected')
      return
    }

    const channelName = getChannelName(sessionId)
    activeRef.current = channelName
    setStatus('connecting')

    const presence = (type: 'client_joined' | 'client_left' | 'client_heartbeat') => ({
      type,
      eventId: nextPresenceId(clientId),
      sessionId,
      clientId,
      timestamp: new Date().toISOString(),
    })

    const channel = client
      .channel(channelName, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'airtype' }, ({ payload }) => {
        onMessageRef.current(payload as BroadcastPayload)
      })
      .subscribe((state) => {
        if (activeRef.current !== channelName) return
        if (state === 'SUBSCRIBED') {
          setStatus('connected')
          channelRef.current
            ?.send({ type: 'broadcast', event: 'airtype', payload: presence('client_joined') })
            .catch(() => {})
          if (presenceTimerRef.current) clearInterval(presenceTimerRef.current)
          presenceTimerRef.current = setInterval(() => {
            if (activeRef.current !== channelName) return
            channelRef.current
              ?.send({ type: 'broadcast', event: 'airtype', payload: presence('client_heartbeat') })
              .catch(() => {})
          }, PRESENCE_HEARTBEAT_MS)
        } else {
          setStatus('reconnecting')
        }
      })

    channelRef.current = channel

    return () => {
      activeRef.current = null
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current)
      channelRef.current
        ?.send({ type: 'broadcast', event: 'airtype', payload: presence('client_left') })
        .catch(() => {})
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [client, sessionId, clientId])

  const send = useCallback(
    (payload: BroadcastPayload) => {
      if (!client || !sessionId || !channelRef.current) return false
      channelRef.current
        .send({
          type: 'broadcast',
          event: 'airtype',
          payload,
        })
        .then((res) => {
          if (res === 'error' || res === 'timed out') {
            setStatus('reconnecting')
          }
        })
        .catch(() => {
          setStatus('reconnecting')
        })
      return true
    },
    [client, sessionId],
  )

  return { status, send }
}
