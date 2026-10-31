import type { ReactNode } from 'react'
import './landing.css'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const FEATURES = [
  {
    title: 'Keyboard lengkap',
    body: 'Lima layer: huruf, simbol, #+=, Fn, dan navigasi. Shift, Caps Lock, dan modifier bekerja seperti keyboard fisik.',
    icon: (
      <Icon>
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 13.5h.01M10 13.5h.01M14 13.5h.01M18 13.5h.01M7.5 16.5h9" />
      </Icon>
    ),
  },
  {
    title: 'Touchpad presisi',
    body: 'Geser kursor, ketuk untuk klik, tahan untuk drag. Sensitivitas kursor bisa diatur dari panel pengaturan.',
    icon: (
      <Icon>
        <rect x="6" y="2.5" width="12" height="19" rx="3.5" />
        <path d="M12 6.5v4" />
        <circle cx="12" cy="15" r="1" />
      </Icon>
    ),
  },
  {
    title: 'Gesture dua jari',
    body: 'Scroll vertikal dan horizontal, pinch untuk zoom, geser untuk back/forward, dan dua ketukan untuk Task View.',
    icon: (
      <Icon>
        <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" />
      </Icon>
    ),
  },
  {
    title: 'Pintasan & template',
    body: 'Ctrl+C, Ctrl+V, Ctrl+Z, Alt+Tab, Win+Tab, dan teks tersimpan yang bisa dikirim sekali ketuk.',
    icon: (
      <Icon>
        <path d="M7 4v7a3 3 0 0 0 3 3h7" />
        <path d="m14 11 4 3-4 3" />
      </Icon>
    ),
  },
  {
    title: 'Pratinjau ketikan',
    body: 'Lihat teks yang baru dikirim langsung di layar HP, lengkap dengan posisi kursor, sebelum pindah ke jendela lain.',
    icon: (
      <Icon>
        <path d="M5 6h14M5 10h14M5 14h9M5 18h6" />
      </Icon>
    ),
  },
  {
    title: 'Sesi acak 128-bit',
    body: 'Setiap pairing memakai kode sesi acak 128-bit. Pesan dikirim lewat channel sementara dan tidak disimpan di server.',
    icon: (
      <Icon>
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </Icon>
    ),
  },
]

const STEPS = [
  {
    title: 'Jalankan Desktop Helper',
    body: 'Aplikasi kecil di PC menampilkan QR dan kode sesi. Biarkan tetap berjalan selama kamu memakai AirType.',
  },
  {
    title: 'Pindai QR dari HP',
    body: 'Buka situs ini di browser HP, tekan Pindai QR desktop, lalu arahkan kamera ke layar PC.',
  },
  {
    title: 'Mulai mengetik dan mengklik',
    body: 'Keyboard, touchpad, gesture, dan pintasan langsung aktif. Tidak ada aplikasi yang perlu dipasang di HP.',
  },
]

const FAQS = [
  {
    q: 'Apakah perlu memasang aplikasi di HP?',
    a: 'Tidak. AirType berjalan di browser HP. Kalau ingin lebih praktis, kamu bisa menambahkannya ke layar utama sebagai PWA dari menu browser.',
  },
  {
    q: 'Apakah butuh koneksi internet?',
    a: 'Ya. HP dan PC terhubung lewat Supabase Realtime, jadi keduanya perlu online. Tidak perlu berada di jaringan Wi-Fi yang sama.',
  },
  {
    q: 'Sistem operasi apa yang didukung?',
    a: 'Desktop Helper tersedia untuk Windows 10 dan 11. Di sisi HP, browser modern seperti Chrome atau Safari sudah cukup.',
  },
  {
    q: 'Apakah ketikan saya disimpan?',
    a: 'Tidak di server. Broadcast realtime bersifat sementara dan kode sesi dibuat acak. Riwayat aktivitas hanya ada di aplikasi desktop dan bisa dimatikan.',
  },
  {
    q: 'Bagaimana cara memutuskan sesi?',
    a: 'Tekan Putuskan di Desktop Helper. AirType mengirim sinyal ke HP, lalu membuat sesi baru dengan QR baru. Kode sesi lama langsung tidak berlaku.',
  },
]

const STRIP = [
  'Tanpa install di HP',
  'Tanpa kabel atau dongle',
  'Windows 10 / 11',
  'Sesi acak 128-bit',
]

function Brand() {
  return (
    <a className="lp-brand" href="/" aria-label="AirType, ke halaman utama">
      <span className="lp-brand-mark" aria-hidden="true">
        <svg
          viewBox="0 0 32 32"
          width="20"
          height="20"
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
      </span>
      <span className="lp-brand-name">AirType</span>
    </a>
  )
}

const MOCK_ROWS: string[][] = [
  'q w e r t y u i o p'.split(' '),
  'a s d f g h j k l'.split(' '),
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
  ['?123', 'space', '⏎'],
]

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="lp-nav">
        <Brand />
        <nav className="lp-nav-links" aria-label="Navigasi halaman">
          <a href="#fitur">Fitur</a>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="lp-btn lp-btn-primary lp-nav-cta" href="/connect">
          Buka aplikasi
        </a>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">Keyboard + touchpad nirkabel</span>
            <h1>
              HP-mu jadi <span className="lp-grad">keyboard</span> dan{' '}
              <span className="lp-grad">touchpad</span> PC.
            </h1>
            <p className="lp-lead">
              Ketik dan kendalikan desktop langsung dari browser HP. Sambungkan lewat satu kode
              QR, tanpa kabel dan tanpa aplikasi tambahan di HP.
            </p>
            <div className="lp-actions">
              <a className="lp-btn lp-btn-primary lp-btn-lg" href="/connect">
                Buka aplikasi
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#cara-kerja">
                Lihat cara kerja
              </a>
            </div>
            <ul className="lp-meta">
              <li>Gratis</li>
              <li>Tanpa install di HP</li>
              <li>Windows 10 / 11</li>
            </ul>
          </div>

          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-phone">
              <div className="lp-phone-screen">
                <div className="lp-mock-status">
                  <span className="lp-mock-dot" />
                  <span>Terhubung</span>
                  <span className="lp-mock-tag">Desktop</span>
                </div>
                <div className="lp-mock-preview">Mengetik dari HP…</div>
                <div className="lp-mock-touchpad">
                  <span className="lp-mock-cursor" />
                </div>
                <div className="lp-mock-keys">
                  {MOCK_ROWS.map((row, rowIndex) => (
                    <div className="lp-mock-row" key={rowIndex}>
                      {row.map((key) => (
                        <span
                          key={key}
                          className={`lp-mock-key${key === 'space' ? ' is-space' : ''}${
                            key.length > 1 && key !== 'space' ? ' is-wide' : ''
                          }`}
                        >
                          {key === 'space' ? '' : key}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lp-float lp-float-a">
              <span className="lp-float-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 4.5 4.5L19 7" />
                </svg>
              </span>
              <span>
                Siap dipakai
                <small>Pairing selesai</small>
              </span>
            </div>
            <div className="lp-float lp-float-b">
              <span className="lp-float-icon is-soft">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 9h16M4 15h16" />
                </svg>
              </span>
              <span>
                Gesture 2 jari
                <small>Scroll, zoom, back</small>
              </span>
            </div>
          </div>
        </section>

        <section className="lp-strip" aria-label="Ringkasan">
          <div className="lp-strip-grid">
            {STRIP.map((item) => (
              <div className="lp-pill" key={item}>
                <span className="lp-pill-dot" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="fitur" className="lp-section">
          <header className="lp-section-head">
            <span className="lp-eyebrow">Fitur</span>
            <h2>Semua yang kamu butuhkan untuk bekerja dari HP.</h2>
            <p>
              AirType bukan sekadar keyboard virtual. Touchpad, gesture, pintasan, dan template
              teks bekerja bersama dalam satu layar.
            </p>
          </header>
          <div className="lp-grid">
            {FEATURES.map((feature) => (
              <article className="lp-feature" key={feature.title}>
                <span className="lp-feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="cara-kerja" className="lp-section">
          <header className="lp-section-head">
            <span className="lp-eyebrow">Cara kerja</span>
            <h2>Tiga langkah, kurang dari satu menit.</h2>
            <p>Begitu Desktop Helper berjalan, pairing cukup dilakukan sekali per sesi.</p>
          </header>
          <ol className="lp-steps">
            {STEPS.map((step, index) => (
              <li className="lp-step" key={step.title}>
                <span className="lp-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="lp-section">
          <header className="lp-section-head">
            <span className="lp-eyebrow">FAQ</span>
            <h2>Pertanyaan yang sering muncul.</h2>
          </header>
          <div className="lp-faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta-band">
          <h2>Siap mengetik dari HP?</h2>
          <p>Jalankan Desktop Helper, pindai QR, dan mulai dalam hitungan detik.</p>
          <a className="lp-btn lp-btn-lg lp-cta-btn" href="/connect">
            Buka aplikasi
          </a>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <Brand />
          <p>Keyboard dan touchpad nirkabel untuk desktop.</p>
        </div>
        <div className="lp-footer-links">
          <a href="#fitur">Fitur</a>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#faq">FAQ</a>
          <a href="/connect">Buka aplikasi</a>
        </div>
      </footer>
    </div>
  )
}
