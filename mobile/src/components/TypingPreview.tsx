import { useEffect, useRef } from 'react'

interface TypingPreviewProps {
  text: string
  cursor: number
  onClear: () => void
}

export default function TypingPreview({ text, cursor, onClear }: TypingPreviewProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
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
  }, [text, cursor])

  return (
    <div className="typing-preview">
      <span className="preview-icon" aria-hidden="true">
        Aa
      </span>
      <div className="typing-preview-body" ref={bodyRef}>
        {text ? (
          <div className="typing-preview-text">
            {text.slice(0, cursor)}
            <span className="preview-cursor" ref={caretRef} />
            {text.slice(cursor)}
          </div>
        ) : (
          <span className="typing-preview-placeholder">Pratinjau ketikan muncul di sini</span>
        )}
      </div>
      <button
        type="button"
        className="preview-clear"
        onClick={onClear}
        disabled={!text}
        aria-label="Bersihkan pratinjau"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5" />
        </svg>
      </button>
    </div>
  )
}
