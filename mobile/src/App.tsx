import { useCallback, useEffect, useMemo, useState } from 'react'
import ConnectScreen from './components/ConnectScreen'
import InstallPrompt from './components/InstallPrompt'
import Keyboard from './components/Keyboard'
import SettingsPanel from './components/SettingsPanel'
import StatusBar from './components/StatusBar'
import TypingPreview from './components/TypingPreview'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { useKeyboard } from './hooks/useKeyboard'
import { useRealtime } from './hooks/useRealtime'
import { useWakeLock } from './hooks/useWakeLock'
import { createSupabaseClient, getChannelName } from './lib/supabase'
import { parseSessionFromUrl } from './lib/session'
import type { BroadcastPayload } from './types'

const CLIENT_ID = `mobile-${Math.random().toString(36).slice(2, 10)}`

function AppInner() {
  const { settings } = useSettings()
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const parsed = parseSessionFromUrl(window.location.href)
    return parsed?.sessionId ?? null
  })
  const [paused, setPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [desktopStatus, setDesktopStatus] = useState<
    'waiting_pairing' | 'connected' | 'paused' | null
  >(null)

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
    haptic: settings.haptic,
    strictMode: settings.strictMode,
    onEcho: (token) => {
      setPreviewText((prev) => (token === '\b' ? prev.slice(0, -1) : prev + token))
    },
  })

  // Fresh preview per session.
  useEffect(() => {
    setPreviewText('')
  }, [sessionId])

  const handleTogglePause = useCallback(() => {
    setPaused((p) => {
      if (p) clearModifiers()
      return !p
    })
  }, [clearModifiers])

  useWakeLock(Boolean(sessionId) && !paused)

  if (!sessionId) {
    return (
      <div className="connect-outer">
        <ConnectScreen onConnect={(id) => setSessionId(id)} />
        <InstallPrompt />
      </div>
    )
  }

  return (
    <div className="app">
      <StatusBar
        status={status}
        paused={paused}
        desktopStatus={desktopStatus}
        onTogglePause={handleTogglePause}
        onOpenSettings={() => setShowSettings(true)}
      />
      <TypingPreview text={previewText} onClear={() => setPreviewText('')} />
      <div className="keyboard-wrap">
        <Keyboard
          modifiers={modifiers}
          shiftLatch={shiftLatch}
          capsLock={capsLock}
          autoReturnToLetters={settings.autoReturnToLetters}
          haptic={settings.haptic}
          onPress={press}
          onRelease={release}
        />
      </div>
      <div className="session-info">Sesi: {getChannelName(sessionId)}</div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  )
}
