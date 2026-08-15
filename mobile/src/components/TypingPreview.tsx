import { useEffect, useRef } from 'react'

interface TypingPreviewProps {
  text: string
  onClear: () => void
}

export default function TypingPreview({ text, onClear }: TypingPreviewProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

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
          <div className="typing-preview-text">{text}</div>
        ) : (
          <span className="typing-preview-placeholder">Ketik untuk melihat hasil di sini</span>
        )}
      </div>
    </div>
  )
}
