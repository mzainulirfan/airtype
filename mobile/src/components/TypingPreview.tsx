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
    if (caretRef.current) {
      caretRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
