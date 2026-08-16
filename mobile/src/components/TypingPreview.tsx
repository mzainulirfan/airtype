import { useEffect, useRef, useState } from 'react'

interface TypingPreviewProps {
  text: string
  cursor: number
  onClear: () => void
}

export default function TypingPreview({ text, cursor, onClear }: TypingPreviewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (collapsed) return
    const body = bodyRef.current
    const caret = caretRef.current
    if (!body || !caret) return
    // Keep the caret visible by scrolling only this preview box, never the
    // page. scrollIntoView can scroll ancestor containers and hide the box.
    try {
      const bodyRect = body.getBoundingClientRect()
      const caretRect = caret.getBoundingClientRect()
      if (caretRect.bottom > bodyRect.bottom) {
        body.scrollTop += caretRect.bottom - bodyRect.bottom + 4
      } else if (caretRect.top < bodyRect.top) {
        body.scrollTop -= bodyRect.top - caretRect.top + 4
      }
    } catch {
      /* ignore */
    }
  }, [text, cursor, collapsed])

  return (
    <div className={`typing-preview ${collapsed ? 'collapsed' : ''}`}>
      <div className="typing-preview-head">
        <button type="button" className="collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d={collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
          </svg>
        </button>
        <span className="typing-preview-title">Pratinjau ketikan</span>
        <button type="button" className="clear-btn" onClick={onClear} disabled={!text}>
          Hapus
        </button>
      </div>
      {!collapsed && (
        <div className="typing-preview-body" ref={bodyRef}>
          {text ? (
            <div className="typing-preview-text">
              {text.slice(0, cursor)}
              <span className="preview-cursor" ref={caretRef} />
              {text.slice(cursor)}
            </div>
          ) : (
            <span className="typing-preview-placeholder">Teks yang Anda ketik akan muncul di sini</span>
          )}
        </div>
      )}
    </div>
  )
}
