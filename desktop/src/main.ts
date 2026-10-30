import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import QRCode from 'qrcode'
import './styles.css'
import type {
  Bridge,
  ClientInfo,
  HistoryItem,
  SessionInfo,
  Stats,
  Status,
  UiSnapshot,
} from './types'

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Menyiapkan…',
  creating_session: 'Membuat sesi…',
  subscribing: 'Menghubungkan…',
  waiting_pairing: 'Menunggu HP',
  connected: 'Terhubung',
  paused: 'Dijeda',
  reconnecting: 'Menyambung ulang…',
}

const KEY_LABEL: Record<string, string> = {
  Space: 'Spasi',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Escape: 'Esc',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  ArrowUp: 'Panah atas',
  ArrowDown: 'Panah bawah',
  ArrowLeft: 'Panah kiri',
  ArrowRight: 'Panah kanan',
  ShiftLeft: 'Shift kiri',
  ShiftRight: 'Shift kanan',
  ControlLeft: 'Ctrl kiri',
  ControlRight: 'Ctrl kanan',
  AltLeft: 'Alt kiri',
  AltRight: 'Alt kanan',
  MetaLeft: 'Win',
  MetaRight: 'Win',
  CapsLock: 'Caps Lock',
  PrintScreen: 'PrtScr',
}

const MOUSE_LABEL: Record<string, string> = {
  down: 'Klik',
  up: 'Lepas klik',
  scroll: 'Scroll',
}

const emptyStats = (): Stats => ({
  chars: 0,
  keyEvents: 0,
  mouseEvents: 0,
  errors: 0,
  lastActivityMs: null,
})

const numberFormat = new Intl.NumberFormat('id-ID')

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T

const els = {
  hostname: $('hostname'),
  status: $('status'),
  statusLabel: $('status-label'),
  errorBanner: $('error-banner'),
  errorText: $('error-text'),
  errorDismiss: $('error-dismiss'),
  pairingView: $('pairing-view'),
  connectedView: $('connected-view'),
  connectedHero: $('connected-hero'),
  qrCode: $('qr-code'),
  qrEmpty: $('qr-empty'),
  qrEmptyLabel: $('qr-empty-label'),
  sessionCode: $('session-code'),
  sessionCodeCompact: $('session-code-compact'),
  pairingUrl: $('pairing-url'),
  copyCode: $('copy-code'),
  copyCodeCompact: $('copy-code-compact'),
  copyUrl: $('copy-url'),
  copyUrlCompact: $('copy-url-compact'),
  newSession: $('new-session'),
  connTitle: $('conn-title'),
  connHost: $('conn-host'),
  connDuration: $('conn-duration'),
  connNote: $('conn-note'),
  statChars: $('stat-chars'),
  statKeys: $('stat-keys'),
  statMouse: $('stat-mouse'),
  lastActivity: $('last-activity'),
  pause: $('pause'),
  disconnect: $('disconnect'),
  history: $('history'),
  activityCount: $('activity-count'),
  toast: $('toast'),
}

let bridge: Bridge
let status: Status = 'idle'
let session: SessionInfo | null = null
let client: ClientInfo | null = null
let stats: Stats = emptyStats()
let history: HistoryItem[] = []
let hostname = ''
let historyEnabled = true
let qrToken = 0
let toastTimer: number | undefined
let disconnectTimer: number | undefined

function normalizeStatus(value: string): Status {
  return value in STATUS_LABEL ? (value as Status) : 'idle'
}

function isLinkedView(): boolean {
  return (
    status === 'connected' ||
    status === 'paused' ||
    (status === 'reconnecting' && client !== null)
  )
}

function applyStatus(next: Status) {
  status = next
  els.status.className = `status ${next}`
  els.statusLabel.textContent = STATUS_LABEL[next]
  els.pause.textContent = next === 'paused' ? 'Lanjutkan' : 'Pause'
  els.pause.setAttribute('aria-pressed', String(next === 'paused'))
  renderView()
}

function renderView() {
  const linked = isLinkedView()
  els.pairingView.classList.toggle('hidden', linked)
  els.connectedView.classList.toggle('hidden', !linked)
  if (linked) {
    els.connectedHero.classList.toggle('paused', status === 'paused')
    els.connectedHero.classList.toggle('reconnecting', status === 'reconnecting')
    els.connTitle.textContent = status === 'paused' ? 'Dijeda' : 'Terhubung'
    const note =
      status === 'paused'
        ? 'Input dijeda. Ketuk Lanjutkan agar ketikan dari HP diterima lagi.'
        : status === 'reconnecting'
          ? 'Menyambung ulang ke server…'
          : ''
    els.connNote.textContent = note
    els.connNote.classList.toggle('hidden', !note)
  }
  renderHistory()
  renderConnectionMeta()
  resetDisconnect()
}

function shortSession(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function renderSession() {
  const id = session?.sessionId ?? ''
  const url = session?.pairingUrl ?? ''
  els.sessionCode.textContent = id || '—'
  els.sessionCodeCompact.textContent = id ? shortSession(id) : '—'
  els.sessionCodeCompact.title = id
  els.pairingUrl.textContent = url || '—'
  els.pairingUrl.title = url

  if (!url) {
    qrToken += 1
    els.qrCode.replaceChildren()
    els.qrCode.classList.add('hidden')
    els.qrEmpty.classList.remove('hidden')
    els.qrEmptyLabel.textContent = 'Tautan pairing belum tersedia'
    return
  }

  els.qrEmpty.classList.remove('hidden')
  els.qrEmptyLabel.textContent = 'Menyiapkan QR…'
  const token = ++qrToken
  void QRCode.toDataURL(url, {
    width: 184,
    margin: 1,
    color: { dark: '#0b1220', light: '#ffffff' },
  })
    .then((dataUrl) => {
      if (token !== qrToken) return
      const img = document.createElement('img')
      img.src = dataUrl
      img.alt = 'QR pairing'
      img.width = 184
      img.height = 184
      els.qrCode.replaceChildren(img)
      els.qrCode.classList.remove('hidden')
      els.qrEmpty.classList.add('hidden')
    })
    .catch((err) => {
      if (token !== qrToken) return
      console.error('QR generate failed:', err)
      els.qrEmptyLabel.textContent = 'Gagal membuat QR'
    })
}

function renderStats() {
  els.statChars.textContent = numberFormat.format(stats.chars)
  els.statKeys.textContent = numberFormat.format(stats.keyEvents)
  els.statMouse.textContent = numberFormat.format(stats.mouseEvents)
}

function renderClient() {
  els.connHost.textContent = hostname || '—'
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

function relativeTime(at: number): string {
  const diff = Math.max(0, Date.now() - at)
  if (diff < 3000) return 'baru saja'
  if (diff < 60_000) return `${Math.floor(diff / 1000)} dtk lalu`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  return `${Math.floor(diff / 86_400_000)} hari lalu`
}

function renderConnectionMeta() {
  if (client) {
    const prefix = client.approximate ? '±' : ''
    els.connDuration.textContent = prefix + formatDuration(Date.now() - client.connectedAtMs)
  } else {
    els.connDuration.textContent = '—'
  }

  if (stats.lastActivityMs) {
    const suffix = stats.errors > 0 ? ` · ${numberFormat.format(stats.errors)} gagal` : ''
    els.lastActivity.textContent = `Aktivitas terakhir ${relativeTime(stats.lastActivityMs)}${suffix}`
  } else {
    els.lastActivity.textContent = 'Belum ada aktivitas'
  }
}

function keyLabel(code: string | null): string {
  if (!code) return 'Tombol'
  if (KEY_LABEL[code]) return KEY_LABEL[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  return code
}

function historyPreview(item: HistoryItem): string {
  if (item.kind === 'type_text') {
    const text = (item.text ?? '').replace(/\s+/g, ' ').trim()
    return text || '(teks kosong)'
  }
  if (item.kind === 'mouse') {
    return MOUSE_LABEL[item.action ?? ''] ?? 'Mouse'
  }
  return keyLabel(item.code)
}

function historyKind(item: HistoryItem): { badge: string; className: string } {
  switch (item.kind) {
    case 'type_text':
      return { badge: 'TEKS', className: 'kind-text' }
    case 'mouse':
      return { badge: 'MOUSE', className: 'kind-mouse' }
    case 'key_down':
      return { badge: 'TOMBOL', className: 'kind-key' }
    default:
      return { badge: item.kind.toUpperCase(), className: 'kind-other' }
  }
}

function emptyStateText(): string {
  if (!historyEnabled) return 'Riwayat aktivitas dinonaktifkan.'
  return isLinkedView()
    ? 'Belum ada aktivitas. Ketikan dari HP akan muncul di sini.'
    : 'Aktivitas akan muncul setelah HP terhubung.'
}

function renderHistory() {
  const wasAtTop = els.history.scrollTop <= 12
  els.activityCount.textContent = `${history.length} entri`

  if (history.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'history-empty'
    empty.textContent = emptyStateText()
    els.history.replaceChildren(empty)
    updateHistoryFade()
    return
  }

  const rows = history.map((item) => {
    const kind = historyKind(item)
    const row = document.createElement('div')
    row.className = `history-item ${kind.className}`
    if (!item.simulated) row.classList.add('is-error')

    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = kind.badge

    const main = document.createElement('span')
    main.className = 'item-main'
    main.textContent = historyPreview(item)
    main.title = main.textContent

    const time = document.createElement('span')
    time.className = 'item-time'
    const receivedAt = Number(item.receivedAt)
    if (Number.isFinite(receivedAt)) {
      time.dataset.at = String(receivedAt)
      time.textContent = relativeTime(receivedAt)
    }

    const meta = document.createElement('span')
    meta.className = 'item-meta'
    meta.append(time)
    if (!item.simulated) {
      const failed = document.createElement('span')
      failed.className = 'failed-tag'
      failed.textContent = 'gagal'
      meta.append(failed)
    }

    const body = document.createElement('span')
    body.className = 'item-body'
    body.append(main, meta)

    row.append(badge, body)
    return row
  })

  els.history.replaceChildren(...rows)
  if (wasAtTop) els.history.scrollTop = 0
  updateHistoryFade()
}

function updateRelativeTimes() {
  els.history.querySelectorAll<HTMLElement>('.item-time').forEach((el) => {
    const at = Number(el.dataset.at)
    if (Number.isFinite(at)) el.textContent = relativeTime(at)
  })
}

function updateHistoryFade() {
  const el = els.history
  const hasRows = history.length > 0
  const overflowing = el.scrollHeight > el.clientHeight + 4
  const moreBelow =
    hasRows && overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 4
  el.classList.toggle('fade-bottom', moreBelow)
}

function showToast(message: string) {
  els.toast.textContent = message
  els.toast.classList.add('show')
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 1800)
}

function showError(message: string) {
  els.errorText.textContent = message
  els.errorBanner.classList.remove('hidden')
}

function hideError() {
  els.errorBanner.classList.add('hidden')
}

async function copyText(text: string, message: string) {
  if (!text || text === '—') {
    showToast('Belum ada yang bisa disalin')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    if (!copied) {
      showToast('Gagal menyalin')
      return
    }
  }
  showToast(message)
}

function resetDisconnect() {
  if (disconnectTimer) {
    window.clearTimeout(disconnectTimer)
    disconnectTimer = undefined
  }
  els.disconnect.textContent = 'Putuskan'
  els.disconnect.classList.remove('confirm')
}

async function startNewSession() {
  try {
    const info = await bridge.invoke<SessionInfo>('new_session')
    session = info
    client = null
    stats = emptyStats()
    history = []
    renderSession()
    renderClient()
    renderStats()
    renderHistory()
    resetDisconnect()
    showToast('Sesi baru dibuat')
  } catch (err) {
    showError(`Gagal membuat sesi baru: ${String(err)}`)
  }
}

async function handleDisconnect() {
  if (disconnectTimer) {
    resetDisconnect()
    await startNewSession()
    return
  }
  els.disconnect.textContent = 'Yakin putuskan?'
  els.disconnect.classList.add('confirm')
  disconnectTimer = window.setTimeout(resetDisconnect, 3000)
}

function applySnapshot(snapshot: UiSnapshot) {
  session = snapshot.session
  client = snapshot.client
  stats = snapshot.stats ?? emptyStats()
  history = snapshot.history ?? []
  hostname = snapshot.hostname
  historyEnabled = snapshot.historyEnabled

  els.hostname.textContent = hostname || '—'
  renderSession()
  renderClient()
  renderStats()
  renderHistory()

  if (snapshot.presence) {
    applyStatus(normalizeStatus(snapshot.presence))
  } else {
    renderView()
  }
}

async function createBridge(): Promise<Bridge> {
  if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
    const mode = new URLSearchParams(window.location.search).get('demo')
    if (mode) {
      const { createDemoBridge } = await import('./demo')
      return createDemoBridge(mode)
    }
  }
  return { listen, invoke }
}

async function init() {
  bridge = await createBridge()

  await bridge.listen<Status>('airtype:status', (event) =>
    applyStatus(normalizeStatus(event.payload)),
  )
  await bridge.listen<HistoryItem[]>('airtype:history', (event) => {
    history = event.payload
    renderHistory()
  })
  await bridge.listen<ClientInfo | null>('airtype:client', (event) => {
    client = event.payload
    renderClient()
    renderView()
  })
  await bridge.listen<Stats>('airtype:stats', (event) => {
    stats = event.payload
    renderStats()
    renderConnectionMeta()
  })

  els.pause.addEventListener('click', () => {
    void bridge.invoke<boolean>('toggle_pause').catch((err) => {
      showError(`Gagal mengubah status jeda: ${String(err)}`)
    })
  })
  els.newSession.addEventListener('click', () => void startNewSession())
  els.disconnect.addEventListener('click', () => void handleDisconnect())
  els.errorDismiss.addEventListener('click', hideError)
  els.copyCode.addEventListener('click', () =>
    void copyText(session?.sessionId ?? '', 'Kode sesi disalin'),
  )
  els.copyCodeCompact.addEventListener('click', () =>
    void copyText(session?.sessionId ?? '', 'Kode sesi disalin'),
  )
  els.copyUrl.addEventListener('click', () =>
    void copyText(session?.pairingUrl ?? '', 'Tautan pairing disalin'),
  )
  els.copyUrlCompact.addEventListener('click', () =>
    void copyText(session?.pairingUrl ?? '', 'Tautan pairing disalin'),
  )

  els.history.addEventListener('scroll', updateHistoryFade)
  window.addEventListener('resize', updateHistoryFade)

  window.setInterval(() => {
    updateRelativeTimes()
    renderConnectionMeta()
  }, 1000)

  try {
    await bridge.invoke('init_app')
  } catch (err) {
    showError(String(err))
  }

  try {
    const snapshot = await bridge.invoke<UiSnapshot>('get_ui_snapshot')
    applySnapshot(snapshot)
  } catch (err) {
    showError(String(err))
  }
}

init().catch((err) => {
  showError(String(err))
})
