import { useCallback, useEffect, useMemo, useState } from 'react'
import ConnectScreen from './components/ConnectScreen'
import InstallPrompt from './components/InstallPrompt'
import Keyboard from './components/Keyboard'
import QuickActions from './components/QuickActions'
import SettingsPanel from './components/SettingsPanel'
import StatusBar from './components/StatusBar'
import TypingPreview from './components/TypingPreview'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { useKeyboard } from './hooks/useKeyboard'
import { useRealtime } from './hooks/useRealtime'
import { useWakeLock } from './hooks/useWakeLock'
import { createSupabaseClient, getChannelName } from './lib/supabase'
import { parseSessionFromUrl } from './lib/session'
import type { BroadcastPayload, EchoToken } from './types'

const CLIENT_ID = `mobile-${Math.random().toString(36).slice(2, 10)}`

interface PreviewState {
  text: string
  cursor: number
}

function applyPreviewToken(prev: PreviewState, token: EchoToken): PreviewState {
  const { text, cursor } = prev
  switch (token.type) {
    case 'insert': {
      const next = text.slice(0, cursor) + token.text + text.slice(cursor)
      return { text: next, cursor: cursor + token.text.length }
    }
    case 'backspace': {
      if (cursor <= 0) return prev
      return { text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 }
    }
    case 'delete': {
      if (cursor >= text.length) return prev
      return { text: text.slice(0, cursor) + text.slice(cursor + 1), cursor }
    }
    case 'left':
      return { text, cursor: Math.max(0, cursor - 1) }
    case 'right':
      return { text, cursor: Math.min(text.length, cursor + 1) }
    case 'home':
      return { text, cursor: 0 }
    case 'end':
      return { text, cursor: text.length }
    case 'enter':
      return { text: text.slice(0, cursor) + '\n' + text.slice(cursor), cursor: cursor + 1 }
    case 'tab':
      return { text: text.slice(0, cursor) + '\t' + text.slice(cursor), cursor: cursor + 1 }
    case 'up':
    case 'down': {
      const lines = text.split('\n')
      let lineIdx = 0
      let lineStart = 0
      for (let i = 0; i < lines.length; i++) {
        if (lineStart + lines[i].length >= cursor) {
          lineIdx = i
          break
        }
        lineStart += lines[i].length + 1
      }
      const col = Math.max(0, cursor - lineStart)
      const target = token.type === 'up' ? lineIdx - 1 : lineIdx + 1
      if (target < 0 || target >= lines.length) return prev
      let targetStart = 0
      for (let i = 0; i < target; i++) targetStart += lines[i].length + 1
      return { text, cursor: targetStart + Math.min(col, lines[target].length) }
    }
    default:
      return prev
  }
}

function AppInner() {
  const { settings } = useSettings()
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const parsed = parseSessionFromUrl(window.location.href)
    return parsed?.sessionId ?? null
  })
  const [paused, setPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ text: '', cursor: 0 })
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

  const applyEcho = useCallback((token: EchoToken) => {
    setPreview((prev) => applyPreviewToken(prev, token))
  }, [])

  const { modifiers, shiftLatch, capsLock, press, release, runChord, clearModifiers } =
    useKeyboard({
      sessionId: sessionId ?? '',
      clientId: CLIENT_ID,
      send,
      paused,
      haptic: settings.haptic,
      strictMode: settings.strictMode,
      onEcho: applyEcho,
    })

  // Fresh preview per session.
  useEffect(() => {
    setPreview({ text: '', cursor: 0 })
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
      <TypingPreview
        text={preview.text}
        cursor={preview.cursor}
        onClear={() => setPreview({ text: '', cursor: 0 })}
      />
      <QuickActions onChord={runChord} />
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
