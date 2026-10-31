import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface QrScannerProps {
  onResult: (sessionId: string) => void
  onClose: () => void
}

const SESSION_RE = /^[0-9a-f]{32}$/
const SCAN_WIDTH = 480
/** Decoding every video frame drains batteries; ~5 scans/s is plenty to lock
 * onto a QR code the user is holding still. */
const SCAN_INTERVAL_MS = 200

function extractSession(raw: string): string | null {
  const candidate = raw.trim()
  if (SESSION_RE.test(candidate)) return candidate
  try {
    const url = new URL(candidate)
    const s = url.searchParams.get('session')
    if (s && SESSION_RE.test(s)) return s
  } catch {
    /* not a url */
  }
  return null
}

export default function QrScanner({ onResult, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let detector: any = null

    const detect = async (video: HTMLVideoElement) => {
      if (cancelled) return
      let raw: string | null = null
      if (typeof (window as any).BarcodeDetector !== 'undefined') {
        try {
          if (!detector) {
            detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          }
          const codes = await detector.detect(video)
          if (codes && codes.length > 0) raw = codes[0].rawValue
        } catch {
          /* fall through to jsqr */
        }
      }
      if (!raw) {
        const canvas = canvasRef.current
        if (canvas && video.videoWidth > 0) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            const scale = SCAN_WIDTH / video.videoWidth
            canvas.width = SCAN_WIDTH
            canvas.height = Math.round(video.videoHeight * scale)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(image.data, canvas.width, canvas.height)
            if (code) raw = code.data
          }
        }
      }
      if (raw) {
        const session = extractSession(raw)
        if (session) {
          onResult(session)
          return
        }
      }
      if (!cancelled) timer = setTimeout(() => detect(video), SCAN_INTERVAL_MS)
    }

    const stop = () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera tidak didukung di browser ini. Masukkan kode secara manual.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stop()
          return
        }
        const video = videoRef.current
        if (!video) {
          stop()
          return
        }
        video.srcObject = stream
        await video.play()
        timer = setTimeout(() => detect(video), SCAN_INTERVAL_MS)
      } catch {
        setError('Tidak dapat mengakses kamera. Izinkan akses kamera, atau masukkan kode manual.')
      }
    }

    start()
    return stop
  }, [onResult])

  return (
    <div className="scanner-overlay">
      <div className="scanner-header">
        <div>
          <h2>Pindai QR</h2>
          <p>Arahkan kamera ke kode di layar desktop.</p>
        </div>
        <button type="button" className="scanner-close-icon" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>

      <div className="scanner-box">
        <video ref={videoRef} className="scanner-video" playsInline muted />
        <canvas ref={canvasRef} className="scanner-canvas" />
        <div className="scanner-frame" aria-hidden="true" />
        {error ? (
          <p className="scanner-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="scanner-hint">Kode QR akan terdeteksi otomatis</p>
        )}
      </div>

      <button type="button" className="scanner-close" onClick={onClose}>
        Tutup kamera
      </button>
    </div>
  )
}
