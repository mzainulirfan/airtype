import { useEffect, useRef } from 'react'

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
      return
    }

    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator)) return
        lockRef.current = await navigator.wakeLock.request('screen')
        lockRef.current.addEventListener('release', () => {
          lockRef.current = null
        })
        if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
      } catch {
        // Wake Lock tidak tersedia atau ditolak - non-fatal
      }
    }

    acquire()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!lockRef.current) acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [active])
}
