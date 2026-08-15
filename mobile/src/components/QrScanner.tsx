import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface QrScannerProps {
  onResult: (sessionId: string) => void
  onClose: () => void
}

const SESSION_RE = /^[0-9a-f]{6}$/
const SCAN_WIDTH = 480

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
    let raf = 0
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
      raf = requestAnimationFrame(() => detect(video))
    }

    const stop = () => {
      cancelled = true
      cancelAnimationFrame(raf)
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
        raf = requestAnimationFrame(() => detect(video))
      } catch {
        setError('Tidak dapat mengakses kamera. Izinkan akses kamera, atau masukkan kode manual.')
      }
    }

    start()
    return stop
  }, [onResult])

  return (
    <div className="scanner-overlay">
      <div className="scanner-box">
        <video ref={videoRef} className="scanner-video" playsInline muted />
        <canvas ref={canvasRef} className="scanner-canvas" />
        <div className="scanner-frame" aria-hidden="true" />
        {error && <p className="scanner-error">{error}</p>}
        {!error && <p className="scanner-hint">Arahkan kamera ke kode QR di desktop</p>}
      </div>
      <button type="button" className="scanner-close" onClick={onClose}>
        Tutup
      </button>
    </div>
  )
}
