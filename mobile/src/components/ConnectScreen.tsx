import { lazy, Suspense, useState } from 'react'
import { validateSessionId } from '../lib/session'
import { isSupabaseConfigured } from '../lib/supabase'

const QrScanner = lazy(() => import('./QrScanner'))

interface ConnectScreenProps {
  notice?: string | null
  onConnect: (sessionId: string) => void
}

export default function ConnectScreen({ notice, onConnect }: ConnectScreenProps) {
  const [sessionId, setSessionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const configured = isSupabaseConfigured()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = sessionId.trim().toLowerCase()
    if (!validateSessionId(value)) {
      setError('Kode sesi tidak valid. Harus 32 karakter hex.')
      return
    }
    setError(null)
    onConnect(value)
  }

  const handleScan = (value: string) => {
    setScanning(false)
    if (validateSessionId(value)) {
      setSessionId(value)
      onConnect(value)
    } else {
      setError('QR tidak berisi kode sesi yang valid.')
    }
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-hero">
          <div className="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              width="34"
              height="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="9" width="21" height="14" rx="3" />
              <path d="M7.5 13h.01M11.5 13h.01M15.5 13h.01M19.5 13h.01M7.5 17h.01M11.5 17h.01M15.5 17h.01M19.5 17h.01" />
              <path d="M28.5 5.5v9M24 10h9" opacity=".7" />
            </svg>
          </div>
          <h1>AirType</h1>
          <p className="connect-tagline">Ketik dan kendalikan PC langsung dari HP.</p>
        </div>

        {!configured && (
          <div className="notice">
            Supabase belum dikonfigurasi. Set <code>VITE_SUPABASE_URL</code> dan{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> di <code>.env</code>.
          </div>
        )}

        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}

        <button
          type="button"
          className="scan-cta"
          disabled={!configured}
          onClick={() => setScanning(true)}
        >
          <span className="scan-cta-icon">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
              <rect x="8" y="8" width="8" height="8" rx="1.2" />
            </svg>
          </span>
          <span className="scan-cta-text">
            <strong>Pindai QR desktop</strong>
            <small>Cara tercepat untuk terhubung</small>
          </span>
          <svg
            className="scan-cta-chevron"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>

        <div className="connect-divider">
          <span>atau masukkan kode sesi</span>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="code-field">
            <span className="code-label">Kode sesi</span>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Tempel 32 karakter di sini"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              maxLength={32}
              aria-invalid={Boolean(error)}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button
            type="submit"
            className="connect-submit"
            disabled={!configured || !sessionId.trim()}
          >
            Hubungkan
          </button>
        </form>

        <p className="connect-foot">
          Kode sesi tersedia di layar <strong>Desktop Helper</strong>.
        </p>
      </div>

      {scanning && (
        <Suspense fallback={<div className="scanner-overlay" />}>
          <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </div>
  )
}
