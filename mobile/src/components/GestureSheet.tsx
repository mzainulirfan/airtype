interface GestureSheetProps {
  onClose: () => void
}

const GESTURES: { gesture: string; action: string }[] = [
  { gesture: '1 jari geser', action: 'Gerakkan kursor' },
  { gesture: 'Ketuk', action: 'Klik kiri' },
  { gesture: '2 jari geser', action: 'Scroll' },
  { gesture: '2 jari ketuk', action: 'Klik kanan' },
  { gesture: 'Ketuk + tahan', action: 'Drag' },
]

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
          {GESTURES.map((g) => (
            <div className="gesture-row" key={g.gesture}>
              <span className="gesture-name">{g.gesture}</span>
              <span className="gesture-action">{g.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}