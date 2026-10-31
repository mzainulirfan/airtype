import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import './landing.css'

const APP_URL = '/connect'
const DOWNLOAD_URL = 'https://github.com/mzainulirfan/airtype/releases'
const DEMO_TEXT = 'halo dari hp'
const DEMO_MAX_CHARS = 24

type IconName = 'kbd' | 'pad' | 'ges' | 'cmd' | 'eye' | 'shd' | 'chk' | 'arr'

const ICONS: Record<IconName, ReactNode> = {
  kbd: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </>
  ),
  pad: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M12 7v3" />
    </>
  ),
  ges: <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  cmd: <path d="M5 5l6 7-6 7M13 19h6" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shd: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chk: <path d="M5 12l5 5 9-10" />,
  arr: <path d="M5 12h14M13 6l6 6-6 6" />,
}

function Glyph({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg className="lp-i" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'kbd',
    title: 'Keyboard lengkap',
    body: 'Lima layer: huruf, simbol, #+=, Fn, dan navigasi. Shift, Caps Lock, dan modifier bekerja seperti keyboard fisik.',
  },
  {
    icon: 'pad',
    title: 'Touchpad presisi',
    body: 'Geser kursor, ketuk untuk klik, tahan untuk drag. Sensitivitas kursor bisa diatur dari panel pengaturan.',
  },
  {
    icon: 'ges',
    title: 'Gesture dua jari',
    body: 'Scroll vertikal dan horizontal, pinch untuk zoom, geser untuk back/forward, dan dua ketukan untuk Task View.',
  },
  {
    icon: 'cmd',
    title: 'Pintasan & template',
    body: 'Ctrl+C, Ctrl+V, Ctrl+Z, Alt+Tab, Win+Tab, dan teks tersimpan yang bisa dikirim sekali ketuk.',
  },
  {
    icon: 'eye',
    title: 'Pratinjau ketikan',
    body: 'Lihat teks yang baru dikirim langsung di layar HP, lengkap dengan posisi kursor, sebelum pindah ke jendela lain.',
  },
  {
    icon: 'shd',
    title: 'Sesi acak 128-bit',
    body: 'Setiap pairing memakai kode sesi acak 128-bit. Pesan dikirim lewat channel sementara dan tidak disimpan di server.',
  },
]

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Apakah perlu memasang aplikasi di HP?',
    a: 'Tidak. AirType berjalan di browser HP. Kamu hanya perlu menjalankan Desktop Helper di PC, dan bisa menambahkan situs ini ke layar utama sebagai PWA bila ingin lebih praktis.',
  },
  {
    q: 'Apakah butuh koneksi internet?',
    a: 'Pairing dan pengiriman pesan memakai channel sementara, jadi PC dan HP perlu terhubung ke internet selama sesi berjalan.',
  },
  {
    q: 'Sistem operasi apa yang didukung?',
    a: 'Desktop Helper mendukung Windows 10 dan Windows 11. Di HP, cukup browser modern.',
  },
  {
    q: 'Apakah ketikan saya disimpan?',
    a: 'Tidak. Pesan dikirim lewat channel sementara dan tidak disimpan di server. Teks template yang kamu simpan sendiri adalah pengecualian dan tersimpan atas pilihanmu.',
  },
  {
    q: 'Bagaimana cara memutuskan sesi?',
    a: 'Tekan Putuskan di Desktop Helper. HP kembali ke halaman pairing, sesi baru dibuat dengan kode acak yang baru, dan kode lama langsung tidak berlaku.',
  },
]

const KEY_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'bs'],
]

const NAV_ITEMS = [
  { id: 'fitur', label: 'Fitur' },
  { id: 'cara', label: 'Cara kerja' },
  { id: 'faq', label: 'FAQ' },
]

function qrCells(seed: number): boolean[] {
  const size = 21
  let state = seed
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647
  const cells: boolean[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = (ax: number, ay: number): boolean | null => {
        const dx = x - ax
        const dy = y - ay
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
          return dx % 6 === 0 || dy % 6 === 0 || (dx > 1 && dx < 5 && dy > 1 && dy < 5)
        }
        return null
      }
      let value = finder(0, 0)
      if (value === null) value = finder(size - 7, 0)
      if (value === null) value = finder(0, size - 7)
      if (value === null) value = random() > 0.52
      cells.push(value)
    }
  }
  return cells
}

function FakeQr({ seed, className = '' }: { seed: number; className?: string }) {
  const cells = useMemo(() => qrCells(seed), [seed])
  return (
    <div className={`lp-qr ${className}`.trim()} aria-hidden="true">
      {cells.map((on, index) => (
        <span key={index} className={on ? 'lp-on-cell' : 'lp-off-cell'} />
      ))}
    </div>
  )
}

function delay(seconds: number): CSSProperties {
  return { '--d': `${seconds}s` } as CSSProperties
}

type SimPos = { left: number; top: number }

export default function LandingPage() {
  const landingRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const stepsRef = useRef<HTMLDivElement | null>(null)
  const pcbRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const curRef = useRef<SVGSVGElement | null>(null)
  const padRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(0)
  const demoRunRef = useRef(0)
  const reducedRef = useRef(false)
  const pressTimerRef = useRef<number | undefined>(undefined)
  const clickTimersRef = useRef<number[]>([])

  const [connected, setConnected] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [doc, setDoc] = useState('')
  const [pos, setPos] = useState<SimPos>({ left: 25, top: 35 })
  const [pressed, setPressed] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [btnPress, setBtnPress] = useState(false)
  const [tap, setTap] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const [openFaq, setOpenFaq] = useState(0)

  const sleep = useCallback(
    (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
    [],
  )

  const pressKey = useCallback((key: string) => {
    setPressed(key)
    window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = window.setTimeout(() => setPressed(null), 140)
  }, [])

  const typeChar = useCallback((char: string) => {
    setDoc((current) => (current.length >= DEMO_MAX_CHARS ? current : current + char))
  }, [])

  const clickFx = useCallback(() => {
    setBtnPress(true)
    setTap(true)
    setSaved(true)
    const timer = window.setTimeout(() => {
      setBtnPress(false)
      setTap(false)
    }, 220)
    clickTimersRef.current.push(timer)
  }, [])

  const takeover = useCallback(() => {
    demoRunRef.current += 1
    setScanning(false)
    setConnected(true)
  }, [])

  const buttonPos = useCallback((): SimPos | null => {
    const button = btnRef.current
    const pcb = pcbRef.current
    if (!button || !pcb) return null
    const b = button.getBoundingClientRect()
    const p = pcb.getBoundingClientRect()
    return {
      left: ((b.left + b.width * 0.5 - p.left) / p.width) * 100,
      top: ((b.top + b.height * 0.45 - p.top) / p.height) * 100,
    }
  }, [])

  const runDemo = useCallback(async () => {
    if (reducedRef.current) return
    const id = ++demoRunRef.current
    const alive = () => demoRunRef.current === id
    while (alive()) {
      setDoc('')
      setSaved(false)
      setScanning(false)
      setConnected(false)
      setPos({ left: 25, top: 35 })

      await sleep(1000)
      if (!alive()) return
      setScanning(true)

      await sleep(2000)
      if (!alive()) return
      setScanning(false)
      setConnected(true)

      await sleep(1100)
      if (!alive()) return
      setPos({ left: 40, top: 30 })

      await sleep(800)
      if (!alive()) return

      for (const char of DEMO_TEXT) {
        if (!alive()) return
        pressKey(char === ' ' ? 'space' : char)
        typeChar(char)
        await sleep(char === ' ' ? 240 : 150)
      }

      await sleep(500)
      if (!alive()) return
      setPos({ left: 50, top: 70 })

      await sleep(900)
      if (!alive()) return
      const target = buttonPos()
      if (target) setPos(target)

      await sleep(1200)
      if (!alive()) return
      clickFx()

      await sleep(3400)
    }
  }, [buttonPos, clickFx, pressKey, sleep, typeChar])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reducedRef.current = reduce
    if (reduce) {
      setConnected(true)
      setDoc(DEMO_TEXT)
      setPos({ left: 70, top: 70 })
      return
    }
    const stage = stageRef.current
    if (!stage) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void runDemo()
          } else {
            demoRunRef.current += 1
          }
        })
      },
      { threshold: 0.25 },
    )
    observer.observe(stage)
    return () => {
      observer.disconnect()
      demoRunRef.current += 1
    }
  }, [runDemo])

  useEffect(() => {
    const root = landingRef.current
    if (!root) return
    const onScroll = () => {
      setScrolled(root.scrollTop > 8)
      const steps = stepsRef.current
      if (steps) {
        const rect = steps.getBoundingClientRect()
        const viewport = window.innerHeight
        const progress = Math.max(
          0,
          Math.min(1, (viewport * 0.8 - rect.top) / (rect.height + viewport * 0.2)),
        )
        steps.style.setProperty('--lp-pg', String(progress))
      }
      let current = ''
      for (const id of ['fitur', 'cara', 'faq']) {
        const node = document.getElementById(id)
        if (node && node.getBoundingClientRect().top < window.innerHeight * 0.4) {
          current = id
        }
      }
      setActive(current)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const root = landingRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-in', '')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    root.querySelectorAll('.lp-rv').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timers = clickTimersRef.current
    return () => {
      window.clearTimeout(pressTimerRef.current)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const moveCursor = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current
    if (!pad) return
    const rect = pad.getBoundingClientRect()
    const clamp = (value: number) => Math.max(0, Math.min(100, value))
    setPos({
      left: clamp(((clientX - rect.left) / rect.width) * 100) * 0.9 + 5,
      top: clamp(((clientY - rect.top) / rect.height) * 100) * 0.9 + 5,
    })
  }, [])

  const handlePadDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    takeover()
    draggingRef.current = true
    movedRef.current = 0
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    moveCursor(event.clientX, event.clientY)
  }

  const handlePadMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    movedRef.current += 1
    moveCursor(event.clientX, event.clientY)
  }

  const handlePadUp = () => {
    draggingRef.current = false
    setDragging(false)
    if (movedRef.current >= 4) return
    const cursor = curRef.current
    const button = btnRef.current
    if (!cursor || !button) return
    const c = cursor.getBoundingClientRect()
    const b = button.getBoundingClientRect()
    const cx = c.left + 4
    const cy = c.top + 4
    if (cx > b.left - 6 && cx < b.right + 6 && cy > b.top - 6 && cy < b.bottom + 6) {
      clickFx()
    }
  }

  const handleKeyTap = (key: string) => {
    takeover()
    pressKey(key)
    if (key === 'space') typeChar(' ')
    else if (key === 'bs') setDoc((current) => current.slice(0, -1))
    else typeChar(key)
  }

  const handleReplay = () => {
    setDoc('')
    if (reducedRef.current) {
      setConnected(true)
      setDoc(DEMO_TEXT)
      setPos({ left: 70, top: 70 })
      return
    }
    void runDemo()
  }

  const handleCardMove = (event: ReactPointerEvent<HTMLElement>) => {
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    card.style.setProperty('--my', `${event.clientY - rect.top}px`)
  }

  const stageClass = [
    'lp-stage',
    'lp-rv',
    connected ? 'lp-on' : '',
    scanning ? 'lp-scan' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="landing" ref={landingRef}>
      <div className="lp-bg" aria-hidden="true">
        <i />
        <i />
      </div>

      <header className={`lp-header${scrolled ? ' lp-scrolled' : ''}`}>
        <div className="lp-w lp-nav">
          <a className="lp-logo" href="#top">
            <b>
              <Glyph name="kbd" size={20} />
            </b>
            AirType
          </a>
          <nav className="lp-links" aria-label="Navigasi halaman">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={active === item.id ? 'lp-act' : undefined}
              >
                {item.label}
              </a>
            ))}
            <a className="lp-btn lp-btn-pri" href={APP_URL}>
              Buka aplikasi
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className="lp-w">
        <div className="lp-hero">
          <div>
            <span className="lp-tag lp-rv">Keyboard + touchpad nirkabel</span>
            <h1 className="lp-rv" style={delay(0.08)}>
              HP-mu jadi <span className="lp-grad">keyboard</span> dan{' '}
              <span className="lp-grad">touchpad</span> PC.
            </h1>
            <p className="lp-lead lp-rv" style={delay(0.16)}>
              Ketik dan kendalikan desktop langsung dari browser HP. Sambungkan lewat satu kode
              QR, tanpa kabel dan tanpa aplikasi tambahan di HP.
            </p>
            <div className="lp-cta lp-rv" style={delay(0.24)}>
              <a className="lp-btn lp-btn-pri" href={APP_URL}>
                Buka aplikasi
                <Glyph name="arr" size={18} />
              </a>
              <a className="lp-btn" href="#cara">
                Lihat cara kerja
              </a>
            </div>
            <p className="lp-mini lp-rv" style={delay(0.32)}>
              <span>Gratis</span>
              <span>Tanpa install di HP</span>
              <span>Windows 10 / 11</span>
            </p>
          </div>

          <div
            className={stageClass}
            ref={stageRef}
            style={delay(0.2)}
            aria-label="Simulasi AirType: pairing, mengetik, dan menggerakkan kursor"
          >
            <div className="lp-pc">
              <div className="lp-bar">
                <i />
                <i />
                <i />
                <span>Catatan.txt</span>
              </div>
              <div className="lp-pcb" ref={pcbRef}>
                <div className="lp-doc">
                  <span>{doc}</span>
                  <span className="lp-caret" />
                </div>
                <div className="lp-ln" style={{ width: '70%' }} />
                <div className="lp-ln" style={{ width: '48%' }} />
                <span className={`lp-saved${saved ? ' lp-show' : ''}`}>
                  <Glyph name="chk" size={12} /> Tersimpan
                </span>
                <button
                  type="button"
                  className={`lp-pcbtn${btnPress ? ' lp-press' : ''}`}
                  ref={btnRef}
                  tabIndex={-1}
                >
                  Simpan
                </button>
                <svg
                  className="lp-cur"
                  ref={curRef}
                  viewBox="0 0 24 24"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    transition: dragging ? 'none' : undefined,
                  }}
                >
                  <path
                    d="M5 3l14 8-6 2 4 7-3 1-4-7-5 4z"
                    fill="var(--accent)"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="lp-qrp">
                  <div>
                    <FakeQr seed={7} />
                    Pindai dengan HP untuk menyambung
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-phone">
              <div className="lp-scr">
                <div className="lp-st">
                  <span>
                    <i className="lp-d" />
                    <span>{connected ? 'Terhubung' : 'Menunggu pindai…'}</span>
                  </span>
                  <em>DESKTOP</em>
                </div>
                <div
                  className="lp-pad"
                  ref={padRef}
                  onPointerDown={handlePadDown}
                  onPointerMove={handlePadMove}
                  onPointerUp={handlePadUp}
                  onPointerCancel={handlePadUp}
                >
                  <div className="lp-h">
                    Geser untuk menggerakkan kursor
                    <br />
                    Ketuk untuk klik
                  </div>
                  <div className="lp-cam">
                    <span>Arahkan ke kode QR</span>
                  </div>
                  <span
                    className={`lp-fing${tap ? ' lp-tap' : ''}`}
                    style={{ left: `${pos.left}%`, top: `${pos.top}%`, transition: dragging ? 'none' : undefined }}
                  />
                </div>
                <div className="lp-keys">
                  {KEY_ROWS.map((row) => (
                    <div className="lp-row" key={row.join('')}>
                      {row.map((key) => (
                        <button
                          type="button"
                          key={key}
                          className={`lp-k${key === 'bs' ? ' lp-wide' : ''}${pressed === key ? ' lp-key-on' : ''}`}
                          data-k={key}
                          tabIndex={-1}
                          onClick={() => handleKeyTap(key)}
                        >
                          {key === 'bs' ? '⌫' : key}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="lp-row">
                    <button type="button" className="lp-k lp-wide" tabIndex={-1}>
                      ?123
                    </button>
                    <button
                      type="button"
                      className={`lp-k lp-space${pressed === 'space' ? ' lp-key-on' : ''}`}
                      data-k="space"
                      tabIndex={-1}
                      onClick={() => handleKeyTap('space')}
                      aria-label="Spasi"
                    />
                    <button type="button" className="lp-k lp-wide" tabIndex={-1}>
                      ↵
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-chip lp-c1">
              <span className="lp-chip-ic lp-chip-ok">
                <Glyph name="chk" size={18} />
              </span>
              <span>
                Siap dipakai
                <small>Pairing selesai</small>
              </span>
            </div>
            <div className="lp-chip lp-c2">
              <span className="lp-chip-ic">
                <Glyph name="ges" size={18} />
              </span>
              <span>
                Gesture 2 jari
                <small>Scroll, zoom, back</small>
              </span>
            </div>

            <button type="button" className="lp-rep" onClick={handleReplay}>
              ↻ Putar ulang demo · coba sendiri: ketuk tombol atau geser touchpad
            </button>
          </div>
        </div>

        <div className="lp-strip">
          <div className="lp-rv">
            <b>&lt; 1 mnt</b>
            <span>dari buka sampai mengetik</span>
          </div>
          <div className="lp-rv" style={delay(0.07)}>
            <b>0</b>
            <span>aplikasi di HP</span>
          </div>
          <div className="lp-rv" style={delay(0.14)}>
            <b>128-bit</b>
            <span>kode sesi acak</span>
          </div>
          <div className="lp-rv" style={delay(0.21)}>
            <b>Win 10/11</b>
            <span>didukung penuh</span>
          </div>
        </div>

        <section id="fitur" className="lp-sec">
          <div className="lp-hd">
            <span className="lp-tag lp-rv">Fitur</span>
            <h2 className="lp-rv">Semua yang kamu butuhkan untuk bekerja dari HP.</h2>
            <p className="lp-rv">
              AirType bukan sekadar keyboard virtual. Touchpad, gesture, pintasan, dan template
              teks bekerja bersama dalam satu layar.
            </p>
          </div>
          <div className="lp-grid">
            {FEATURES.map((feature, index) => (
              <article
                className="lp-card lp-rv"
                key={feature.title}
                style={delay((index % 3) * 0.08)}
                onPointerMove={handleCardMove}
              >
                <div className="lp-card-ic">
                  <Glyph name={feature.icon} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="cara" className="lp-sec">
          <div className="lp-hd">
            <span className="lp-tag lp-rv">Cara kerja</span>
            <h2 className="lp-rv">Tiga langkah, kurang dari satu menit.</h2>
            <p className="lp-rv">
              Begitu Desktop Helper berjalan, pairing cukup dilakukan sekali per sesi.
            </p>
          </div>
          <div className="lp-steps" ref={stepsRef}>
            <div className="lp-ln-b" aria-hidden="true">
              <i />
            </div>
            <div className="lp-step lp-rv">
              <div className="lp-num">1</div>
              <h3>Jalankan Desktop Helper</h3>
              <p>
                Aplikasi kecil di PC menampilkan QR dan kode sesi. Biarkan tetap berjalan selama
                kamu memakai AirType.
              </p>
              <div className="lp-vis">
                <a
                  className="lp-btn lp-btn-pri lp-dl"
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Unduh Desktop Helper
                </a>
              </div>
            </div>
            <div className="lp-step lp-rv" style={delay(0.12)}>
              <div className="lp-num">2</div>
              <h3>Pindai QR dari HP</h3>
              <p>
                Buka situs ini di browser HP, tekan Pindai QR desktop, lalu arahkan kamera ke layar
                PC.
              </p>
              <div className="lp-vis">
                <FakeQr seed={7} className="lp-qr-sc" />
              </div>
            </div>
            <div className="lp-step lp-rv" style={delay(0.24)}>
              <div className="lp-num">3</div>
              <h3>Mulai mengetik dan mengklik</h3>
              <p>
                Keyboard, touchpad, gesture, dan pintasan langsung aktif. Tidak ada aplikasi yang
                perlu dipasang di HP.
              </p>
              <div className="lp-vis">
                <span className="lp-tw">Halo dari HP!</span>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-sec">
          <div className="lp-hd">
            <span className="lp-tag lp-rv">FAQ</span>
            <h2 className="lp-rv">Pertanyaan yang sering muncul.</h2>
          </div>
          <div className="lp-faq">
            {FAQS.map((item, index) => {
              const open = openFaq === index
              return (
                <div
                  className={`lp-q lp-rv${open ? ' lp-open' : ''}`}
                  key={item.q}
                  style={delay(index * 0.06)}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`lp-faq-${index}`}
                    onClick={() => setOpenFaq(open ? -1 : index)}
                  >
                    {item.q}
                    <span className="lp-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                  <div className="lp-ans" id={`lp-faq-${index}`}>
                    <div>
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="lp-band lp-rv">
          <h2>Siap mengetik dari HP?</h2>
          <p>Jalankan Desktop Helper, pindai QR, dan mulai dalam hitungan detik.</p>
          <a className="lp-btn" href={APP_URL}>
            Buka aplikasi
            <Glyph name="arr" size={18} />
          </a>
        </div>

        <footer className="lp-footer">
          <div>
            <a className="lp-logo" href="#top" style={{ fontSize: '1rem' }}>
              <b>
                <Glyph name="kbd" size={17} />
              </b>
              AirType
            </a>
            <div className="lp-footer-tag">Keyboard dan touchpad nirkabel untuk desktop.</div>
          </div>
          <nav>
            <a href="#fitur">Fitur</a>
            <a href="#cara">Cara kerja</a>
            <a href="#faq">FAQ</a>
            <a href={APP_URL}>Buka aplikasi</a>
          </nav>
        </footer>
      </main>
    </div>
  )
}
