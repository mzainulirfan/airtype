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

const CLIENT_ID_KEY = 'airtype_client_id'
const SESSION_STORAGE_KEY = 'airtype_session'

// A stable id lets the desktop remember an approved phone across reloads
// instead of asking for permission again on every re-pair of the same session.
function loadClientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY)
    if (stored && /^mobile-[a-z0-9]{8,40}$/.test(stored)) return stored
  } catch {
    /* storage unavailable */
  }
  const random =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const id = `mobile-${random.slice(0, 16)}`
  try {
    localStorage.setItem(CLIENT_ID_KEY, id)
  } catch {
    /* storage unavailable */
  }
  return id
}

const CLIENT_ID = loadClientId()

type ApprovalState = 'idle' | 'pending'

interface PreviewState {
  text: string
  cursor: number
}

/** Keep the local echo preview bounded so long sessions cannot grow the
 * render tree without limit. Older characters scroll out of view anyway. */
const MAX_PREVIEW_CHARS = 2000

function capPreview(next: PreviewState): PreviewState {
  if (next.text.length <= MAX_PREVIEW_CHARS) return next
  const drop = next.text.length - MAX_PREVIEW_CHARS
  return { text: next.text.slice(drop), cursor: Math.max(0, next.cursor - drop) }
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
  const [approval, setApproval] = useState<ApprovalState>('idle')
  const [connectNotice, setConnectNotice] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [keyboardLayer, setKeyboardLayer] = useState<LayerId>('letters')
  const [preview, setPreview] = useState<PreviewState>({ text: '', cursor: 0 })
  const [showGestureGuide, setShowGestureGuide] = useState(false)
  const [landscapeMode, setLandscapeMode] = useState<LandscapeMode>('keyboard')
  const [desktopStatus, setDesktopStatus] = useState<
    'waiting_pairing' | 'waiting_approval' | 'connected' | 'paused' | null
  >(null)
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)

  const client = useMemo(() => createSupabaseClient(), [])

  const handleMessage = useCallback((event: BroadcastPayload) => {
    if (event.type === 'session_ended') {
      setSessionId(null)
      setDesktopStatus(null)
      setDeviceName(undefined)
      setConnectNotice(
        'Desktop mengakhiri sesi. Pindai QR baru dari Desktop Helper untuk melanjutkan.',
      )
      return
    }
    // The desktop asks this device for permission before accepting its input.
    if (event.type === 'approval_required') {
      if (event.clientId === CLIENT_ID) setApproval('pending')
      return
    }
    if (event.type === 'pairing_result') {
      if (event.clientId !== CLIENT_ID) return
      if (event.approved) {
        setApproval('idle')
        return
      }
      setApproval('idle')
      setSessionId(null)
      setDesktopStatus(null)
      setDeviceName(undefined)
      setConnectNotice(
        'Desktop menolak permintaan pairing. Pindai QR terbaru dari Desktop Helper lalu coba lagi.',
      )
      return
    }
    if (event.type === 'desktop_status') {
      setDesktopStatus(event.status)
      setLastSeenAt(Date.now())
      if (event.deviceName) setDeviceName(event.deviceName)
    }
  }, [])

  // The desktop stopped answering entirely (crashed, quit, or rotated the
  // session without us seeing session_ended). Reconnecting forever would keep
  // a dead keyboard on screen, so drop back to pairing.
  const handleExpired = useCallback(() => {
    setApproval('idle')
    setSessionId(null)
    setDesktopStatus(null)
    setDeviceName(undefined)
    setConnectNotice(
      'Desktop tidak merespons. Pastikan AirType Helper terbuka, lalu pindai QR baru.',
    )
  }, [])

  const { status, send, reconnect } = useRealtime(
    client,
    sessionId,
    CLIENT_ID,
    handleMessage,
    handleExpired,
  )

  const applyEcho = useCallback((token: EchoToken) => {
    setPreview((prev) => capPreview(applyPreviewToken(prev, token)))
  }, [])

  const {
    modifiers,
    shiftLatch,
    capsLock,
    press,
    release,
    typeText,
    runChord,
    clearModifiers,
    mouseMove,
    mouseButton,
    mouseScroll,
  } = useKeyboard({
    sessionId: sessionId ?? '',
    clientId: CLIENT_ID,
    send,
    paused: paused || approval === 'pending',
    haptic: settings.haptic,
    strictMode: settings.strictMode,
    onEcho: applyEcho,
  })

  // A fresh session always starts unapproved; the desktop will say otherwise.
  useEffect(() => {
    setApproval('idle')
  }, [sessionId])

  // The session id is a bearer secret: keep it out of the address bar, shared
  // links and browser history once it has been handed to the app.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('session')) return
    url.searchParams.delete('session')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  // Fresh preview and released modifiers per session: a latched Ctrl/Alt from
  // the old session must not leak into the next one.
  useEffect(() => {
    setPreview({ text: '', cursor: 0 })
    clearModifiers()
  }, [sessionId, clearModifiers])

  // First-time onboarding: show the touchpad gesture guide once a session
  // connects. Dismissed by closing the sheet.
  useEffect(() => {
    if (sessionId && approval === 'idle' && !settings.seenGestureGuide) {
      setShowGestureGuide(true)
    }
  }, [sessionId, approval, settings.seenGestureGuide])

  // The approval prompt takes priority over any open sheet: the user has to
  // accept the device before the keyboard can be used anyway.
  useEffect(() => {
    if (approval === 'pending') setShowGestureGuide(false)
  }, [approval])

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
    setApproval('idle')
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

  useWakeLock(Boolean(sessionId) && !paused && approval === 'idle')

  if (!sessionId) {
    return (
      <div className="connect-outer">
        <ConnectScreen
          notice={connectNotice}
          onConnect={(id) => {
            setConnectNotice(null)
            setSessionId(id)
          }}
        />
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
      <ShortcutsBar
        onChord={handleChord}
        onInsertText={typeText}
        favorites={settings.favoriteShortcuts}
      />
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
      {showGestureGuide && approval !== 'pending' && (
        <GestureSheet onClose={handleCloseGestureGuide} />
      )}
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
      {approval === 'pending' && (
        <div
          className="approval-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-title"
        >
          <div className="approval-card">
            <span className="approval-spinner" aria-hidden="true" />
            <h2 id="approval-title">Menunggu persetujuan desktop</h2>
            <p>
              Buka <strong>AirType Helper</strong> di komputer, lalu tekan{' '}
              <strong>Terima</strong> pada permintaan pairing.
            </p>
            <p className="approval-hint">
              Hanya setujui jika kamu sendiri yang memindai QR ini.
            </p>
            <button type="button" className="approval-cancel" onClick={handleDisconnect}>
              Putuskan
            </button>
          </div>
        </div>
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
