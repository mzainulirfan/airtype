import { useCallback, useEffect, useMemo, useState } from 'react'
import ConnectScreen from './components/ConnectScreen'
import GestureSheet from './components/GestureSheet'
import InstallPrompt from './components/InstallPrompt'
import Keyboard from './components/Keyboard'
import SettingsPanel from './components/SettingsPanel'
import ShortcutsBar from './components/ShortcutsBar'
import StatusBar, { type LandscapeMode } from './components/StatusBar'
import Touchpad from './components/Touchpad'
import TypingPreview from './components/TypingPreview'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { useKeyboard } from './hooks/useKeyboard'
import { useRealtime } from './hooks/useRealtime'
import { useWakeLock } from './hooks/useWakeLock'
import { createSupabaseClient } from './lib/supabase'
import { parseSessionFromUrl, validateSessionId } from './lib/session'
import type { Chord } from './lib/chords'
import { GESTURE_CHORDS } from './lib/chords'
import type { LayerId } from './lib/keys'
import type { BroadcastPayload, EchoToken, GestureName } from './types'

const CLIENT_ID = `mobile-${Math.random().toString(36).slice(2, 10)}`
const SESSION_STORAGE_KEY = 'airtype_session'

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
  const { settings, update } = useSettings()
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const urlSession = parseSessionFromUrl(window.location.href)?.sessionId
    if (urlSession) return urlSession
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (stored && validateSessionId(stored)) return stored
    } catch {
      /* storage unavailable */
    }
    return null
  })
  const [paused, setPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [keyboardLayer, setKeyboardLayer] = useState<LayerId>('letters')
  const [preview, setPreview] = useState<PreviewState>({ text: '', cursor: 0 })
  const [showGestureGuide, setShowGestureGuide] = useState(false)
  const [landscapeMode, setLandscapeMode] = useState<LandscapeMode>('keyboard')
  const [desktopStatus, setDesktopStatus] = useState<
    'waiting_pairing' | 'connected' | 'paused' | null
  >(null)
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)

  const client = useMemo(() => createSupabaseClient(), [])

  const handleMessage = useCallback((event: BroadcastPayload) => {
    if (event.type === 'desktop_status') {
      setDesktopStatus(event.status)
      setLastSeenAt(Date.now())
      if (event.deviceName) setDeviceName(event.deviceName)
    }
  }, [])

  const { status, send, reconnect } = useRealtime(client, sessionId, CLIENT_ID, handleMessage)

  const applyEcho = useCallback((token: EchoToken) => {
    setPreview((prev) => applyPreviewToken(prev, token))
  }, [])

  const {
    modifiers,
    shiftLatch,
    capsLock,
    press,
    release,
    runChord,
    clearModifiers,
    mouseMove,
    mouseButton,
    mouseScroll,
  } = useKeyboard({
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

  // First-time onboarding: show the touchpad gesture guide once a session
  // connects. Dismissed by closing the sheet.
  useEffect(() => {
    if (sessionId && !settings.seenGestureGuide) {
      setShowGestureGuide(true)
    }
  }, [sessionId, settings.seenGestureGuide])

  const handleCloseGestureGuide = useCallback(() => {
    setShowGestureGuide(false)
    if (!settings.seenGestureGuide) update({ seenGestureGuide: true })
  }, [settings.seenGestureGuide, update])

  // Remember the session across refreshes so the user does not have to scan
  // the QR code again. Cleared when the user explicitly disconnects.
  useEffect(() => {
    try {
      if (sessionId) {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY)
      }
    } catch {
      /* storage unavailable */
    }
  }, [sessionId])

  const handleDisconnect = useCallback(() => {
    setSessionId(null)
  }, [])

  const handleTogglePause = useCallback(
    // The pause state lives on the desktop; the phone only relays the user's
    // intent. The desktop broadcasts the new desktop_status back.
    (target: boolean) => {
      if (!target) clearModifiers()
      send({
        type: 'client_pause',
        sessionId: sessionId ?? '',
        clientId: CLIENT_ID,
        eventId: `pause-${Date.now().toString(36)}`,
        paused: target,
        timestamp: new Date().toISOString(),
      })
    },
    [clearModifiers, send, sessionId],
  )

  // Mirror the desktop's paused state so the phone's button matches reality
  // and the phone stops sending keystrokes while the desktop is paused.
  useEffect(() => {
    setPaused(desktopStatus === 'paused')
  }, [desktopStatus])

  const handleChord = useCallback(
    (chord: Chord) => {
      runChord(chord)
      // Win+Tab opens the Windows task view; show arrow keys so the user can
      // navigate the window thumbnails right away.
      if (chord.label === 'Win+Tab') {
        setKeyboardLayer('nav')
      }
    },
    [runChord],
  )

  const handleGesture = useCallback(
    (gesture: GestureName) => {
      const chord = GESTURE_CHORDS[gesture]
      if (chord) handleChord(chord)
    },
    [handleChord],
  )

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
    <div className={`app ${landscapeMode === 'keyboard' ? 'landscape-keyboard' : 'landscape-touchpad'}`}>
      <StatusBar
        status={status}
        paused={paused}
        desktopStatus={desktopStatus}
        deviceName={deviceName}
        mode={landscapeMode}
        onToggleMode={() =>
          setLandscapeMode((m) => (m === 'keyboard' ? 'touchpad' : 'keyboard'))
        }
        onTogglePause={handleTogglePause}
        onOpenSettings={() => setShowSettings(true)}
      />
      {settings.showTypingPreview && (
        <TypingPreview
          text={preview.text}
          cursor={preview.cursor}
          onClear={() => setPreview({ text: '', cursor: 0 })}
        />
      )}
      <ShortcutsBar onChord={handleChord} favorites={settings.favoriteShortcuts} />
      <Touchpad
        onMove={mouseMove}
        onButton={mouseButton}
        onScroll={mouseScroll}
        sensitivity={settings.cursorSensitivity}
        onHelp={() => setShowGestureGuide(true)}
        onGesture={handleGesture}
      />
      <div className="keyboard-wrap">
        <Keyboard
          modifiers={modifiers}
          shiftLatch={shiftLatch}
          capsLock={capsLock}
          autoReturnToLetters={settings.autoReturnToLetters}
          haptic={settings.haptic}
          layer={keyboardLayer}
          onLayerChange={setKeyboardLayer}
          onPress={press}
          onRelease={release}
        />
      </div>
      {showGestureGuide && <GestureSheet onClose={handleCloseGestureGuide} />}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          sessionId={sessionId}
          connectionStatus={status}
          desktopStatus={desktopStatus}
          paused={paused}
          deviceName={deviceName}
          lastSeenAt={lastSeenAt}
          onReconnect={reconnect}
          onDisconnect={handleDisconnect}
        />
      )}
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
