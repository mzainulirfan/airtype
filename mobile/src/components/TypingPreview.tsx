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
      <div className="typing-preview-head">
        <span className="typing-preview-title">Preview ketikan</span>
        <button type="button" className="clear-btn" onClick={onClear} disabled={!text}>
          Hapus
        </button>
      </div>
      <div className="typing-preview-body" ref={bodyRef}>
        {text ? (
          <div className="typing-preview-text">
            {text.slice(0, cursor)}
            <span className="preview-cursor" ref={caretRef} />
            {text.slice(cursor)}
          </div>
        ) : (
          <span className="typing-preview-placeholder">Ketik untuk melihat hasil di sini</span>
        )}
      </div>
    </div>
  )
}
