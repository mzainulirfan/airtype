import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import QRCode from 'qrcode'
import './styles.css'

type Status = 'idle' | 'creating_session' | 'subscribing' | 'waiting_pairing' | 'connected' | 'paused' | 'reconnecting'

interface HistoryItem {
  id: string
  kind: string
  code: string | null
  text: string | null
  receivedAt: string
  simulated: boolean
}

interface SessionInfo {
  sessionId: string
  channel: string
  pairingUrl: string
}

let currentStatus: Status = 'idle'
let currentSession: SessionInfo | null = null

const statusEl = () => document.getElementById('status') as HTMLElement
const qrCodeEl = () => document.getElementById('qr-code') as HTMLElement
const sessionCodeEl = () => document.getElementById('session-code') as HTMLElement
const pairingUrlEl = () => document.getElementById('pairing-url') as HTMLElement
const historyEl = () => document.getElementById('history') as HTMLElement
const pauseBtn = () => document.getElementById('pause') as HTMLButtonElement
const newSessionBtn = () => document.getElementById('new-session') as HTMLButtonElement

function setStatus(status: Status) {
  currentStatus = status
  const el = statusEl()
  el.textContent = statusLabel(status)
  el.className = `status ${status}`
}

function statusLabel(status: Status): string {
  switch (status) {
    case 'idle': return 'Idle'
    case 'creating_session': return 'Membuat sesi…'
    case 'subscribing': return 'Menghubungkan…'
    case 'waiting_pairing': return 'Menunggu pairing'
    case 'connected': return 'Terhubung'
    case 'paused': return 'Dijeda'
    case 'reconnecting': return 'Menyambung ulang…'
  }
}

function renderSession(session: SessionInfo | null) {
  if (!session) {
    sessionCodeEl().textContent = '—'
    pairingUrlEl().textContent = '—'
    qrCodeEl().innerHTML = ''
    qrCodeEl().classList.add('hidden')
    return
  }
  sessionCodeEl().textContent = session.sessionId
  pairingUrlEl().textContent = session.pairingUrl
  pairingUrlEl().title = session.pairingUrl
  if (session.pairingUrl) {
    QRCode.toDataURL(session.pairingUrl, { width: 180, margin: 1 })
      .then((url) => {
        qrCodeEl().innerHTML = `<img src="${url}" alt="QR pairing" width="180" height="180" />`
        qrCodeEl().classList.remove('hidden')
      })
      .catch((err) => {
        console.error('QR generate failed:', err)
      })
  } else {
    qrCodeEl().innerHTML = ''
    qrCodeEl().classList.add('hidden')
  }
}

function renderHistory(items: HistoryItem[]) {
  const el = historyEl()
  el.innerHTML = ''
  if (items.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'history-empty'
    empty.textContent = 'Belum ada keystroke.'
    el.appendChild(empty)
    return
  }
  for (const item of items.slice().reverse()) {
    const row = document.createElement('div')
    row.className = 'history-item'
    const label = item.kind === 'type_text' ? (item.text ?? '') : (item.code ?? '')
    row.textContent = `[${new Date(Number(item.receivedAt)).toLocaleTimeString()}] ${item.kind} ${label}`
    el.appendChild(row)
  }
}

async function refresh() {
  const info = await invoke<SessionInfo>('get_session_info')
  currentSession = info
  renderSession(info)
}

async function init() {
  await listen<Status>('airtype:status', (e) => setStatus(e.payload))
  await listen<HistoryItem[]>('airtype:history', (e) => renderHistory(e.payload))

  pauseBtn().addEventListener('click', () => invoke('toggle_pause'))
  newSessionBtn().addEventListener('click', () => invoke('new_session'))

  await invoke('init_app')
  await refresh()
}

init().catch((err) => {
  statusEl().textContent = `Error: ${err}`
})
