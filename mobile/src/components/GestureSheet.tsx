interface GestureSheetProps {
  onClose: () => void
}

const BASIC_GESTURES: { gesture: string; action: string }[] = [
  { gesture: '1 jari geser', action: 'Gerakkan kursor' },
  { gesture: 'Ketuk', action: 'Klik kiri' },
  { gesture: 'Ketuk + tahan', action: 'Drag' },
  { gesture: '2 jari ketuk', action: 'Klik kanan' },
  { gesture: '2 jari geser', action: 'Scroll' },
]

const MULTI_GESTURES: { gesture: string; action: string }[] = [
  { gesture: '2 jari geser kiri', action: 'Kembali (Alt+←)' },
  { gesture: '2 jari geser kanan', action: 'Maju (Alt+→)' },
  { gesture: '2 jari ketuk 2× cepat', action: 'Task view (Win+Tab)' },
  { gesture: 'Cubit keluar', action: 'Perbesar (Ctrl++)' },
  { gesture: 'Cubit masuk', action: 'Perkecil (Ctrl+-)' },
]

function GestureList({ items }: { items: { gesture: string; action: string }[] }) {
  return (
    <>
      {items.map((g) => (
        <div className="gesture-row" key={g.gesture}>
          <span className="gesture-name">{g.gesture}</span>
          <span className="gesture-action">{g.action}</span>
        </div>
      ))}
    </>
  )
}

export default function GestureSheet({ onClose }: GestureSheetProps) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Cara Menggunakan Touchpad</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="sheet-body">
          <section className="sheet-group">
            <h3>Dasar</h3>
            <GestureList items={BASIC_GESTURES} />
          </section>
          <section className="sheet-group">
            <h3>Multi-jari</h3>
            <GestureList items={MULTI_GESTURES} />
            <p className="settings-section-hint">
              Gesture 3 jari tidak dipakai karena diambil alih sistem HP
              (Android/iOS) — gunakan ketuk 2× cepat atau pintasan di lembar
              Pintasan.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}