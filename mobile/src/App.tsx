import { useCallback, useMemo, useState } from 'react'
import ConnectScreen from './components/ConnectScreen'
import Keyboard from './components/Keyboard'
import StatusBar from './components/StatusBar'
import { useKeyboard } from './hooks/useKeyboard'
import { useRealtime } from './hooks/useRealtime'
import { useWakeLock } from './hooks/useWakeLock'
import { createSupabaseClient, getChannelName } from './lib/supabase'
import { parseSessionFromUrl } from './lib/session'
import type { BroadcastPayload } from './types'

const CLIENT_ID = `mobile-${Math.random().toString(36).slice(2, 10)}`

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const parsed = parseSessionFromUrl(window.location.href)
    return parsed?.sessionId ?? null
  })
  const [paused, setPaused] = useState(false)
  const [desktopStatus, setDesktopStatus] = useState<'waiting_pairing' | 'connected' | 'paused' | null>(null)

  const client = useMemo(() => createSupabaseClient(), [])

  const handleMessage = useCallback((event: BroadcastPayload) => {
    if (event.type === 'desktop_status') {
      setDesktopStatus(event.status)
    }
  }, [])

  const { status, send } = useRealtime(client, sessionId, CLIENT_ID, handleMessage)

  const { modifiers, shiftLatch, capsLock, press, release, clearModifiers } = useKeyboard({
    sessionId: sessionId ?? '',
    clientId: CLIENT_ID,
    send,
    paused,
  })

  const handleTogglePause = useCallback(() => {
    setPaused((p) => {
      if (p) clearModifiers()
      return !p
    })
  }, [clearModifiers])

  useWakeLock(Boolean(sessionId) && !paused)

  if (!sessionId) {
    return (
      <ConnectScreen onConnect={(id) => setSessionId(id)} />
    )
  }

  return (
    <div className="app">
      <StatusBar
        status={status}
        paused={paused}
        desktopStatus={desktopStatus}
        onTogglePause={handleTogglePause}
      />
      <div className="keyboard-wrap">
        <Keyboard
          modifiers={modifiers}
          shiftLatch={shiftLatch}
          capsLock={capsLock}
          onPress={press}
          onRelease={release}
        />
      </div>
      <div className="session-info">Sesi: {getChannelName(sessionId)}</div>
    </div>
  )
}
