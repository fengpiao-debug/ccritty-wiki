import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function ImagePreviewDialog({ src, alt, onClose }) {
  const dialogRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="image-preview-dialog" aria-label={`图片预览：${alt}`}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <button type="button" className="image-preview-close" aria-label="关闭图片预览" onClick={onClose}><X size={24} /></button>
    {failed ? <p role="alert">图片暂时无法加载，请关闭后重试。</p>
      : <img src={src} alt={alt} onError={() => setFailed(true)} />}
  </dialog>, document.body)
}

export function ImagePreview({ src, alt, className, label }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={`image-preview-trigger ${className || ''}`} aria-label={label || `查看${alt}原图`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </button>
    {open && <ImagePreviewDialog key={src} src={src} alt={alt} onClose={() => setOpen(false)} />}
  </>
}
