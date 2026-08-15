import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (dismissed) return null

  const handleInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    setDeferred(null)
    setDismissed(true)
  }

  return (
    <div className="install-prompt" role="note">
      <div className="install-prompt-text">
        {deferred ? (
          <span>Pasang AirType supaya terbuka lebih cepat dan layar penuh.</span>
        ) : (
          <span>
            Tips: di browser buka menu <strong>Share</strong> lalu <strong>Add to Home Screen</strong>{' '}
            supaya AirType terpasang seperti aplikasi.
          </span>
        )}
      </div>
      {deferred && (
        <button type="button" className="install-prompt-btn" onClick={handleInstall}>
          Pasang
        </button>
      )}
      <button
        type="button"
        className="install-prompt-close"
        aria-label="Tutup"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  )
}
