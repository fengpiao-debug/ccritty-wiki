// 文件作用：共用后台对话框，管理初始焦点、焦点循环、Escape 关闭和页面滚动锁。
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

export function AdminDialog({ title, onClose, busy = false, children, wide = false }) {
  const titleId = useId()
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  closeRef.current = onClose
  busyRef.current = busy
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('input, button')?.focus()
    const keyboard = (event) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current()
      if (event.key !== 'Tab') return
      const controls = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((item) => !item.hidden)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [])
  return <div className="cms-modal-backdrop"><section ref={ref} className={`cms-dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header><h2 id={titleId}>{title}</h2><button type="button" className="cms-icon" disabled={busy} title="关闭" aria-label="关闭" onClick={onClose}><X size={19} /></button></header>
    {children}
  </section></div>
}
