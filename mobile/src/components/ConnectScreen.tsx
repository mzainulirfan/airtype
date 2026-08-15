import { useState } from 'react'
import { validateSessionId } from '../lib/session'
import { isSupabaseConfigured } from '../lib/supabase'

interface ConnectScreenProps {
  initialSession?: string
  onConnect: (sessionId: string) => void
}

export default function ConnectScreen({ initialSession, onConnect }: ConnectScreenProps) {
  const [sessionId, setSessionId] = useState(initialSession ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = sessionId.trim()
    if (!validateSessionId(value)) {
      setError('Kode sesi tidak valid. Harus 4 karakter hex.')
      return
    }
    setError(null)
    onConnect(value)
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <rect x="2" y="7" width="20" height="10" rx="2" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <rect x="4" y="9" width="2" height="2" fill="#38bdf8" />
            <rect x="8" y="9" width="2" height="2" fill="#38bdf8" />
            <rect x="12" y="9" width="2" height="2" fill="#38bdf8" />
            <rect x="16" y="9" width="2" height="2" fill="#38bdf8" />
            <path d="M2 5 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4" fill="none" stroke="#34d399" strokeWidth="1.5" />
          </svg>
        </div>
        <h1>AirType</h1>
        <p>Masukkan kode sesi dari Desktop Helper untuk terhubung.</p>

        {!isSupabaseConfigured() && (
          <div className="notice">
            Supabase belum dikonfigurasi. Set <code>VITE_SUPABASE_URL</code> dan{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> di <code>.env</code>.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="Kode sesi"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            maxLength={4}
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" className="primary" disabled={!isSupabaseConfigured()}>
            Hubungkan
          </button>
        </form>
      </div>
    </div>
  )
}
