// 文件作用：独立内容编辑窗口，进入即申请编辑锁；锁冲突降为只读，保存或退出时释放锁。
import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { ContentFields } from './ContentFields'

export function ContentEditorDialog({ item, module, canWrite, onClose, onSaved }) {
  const [draft, setDraft] = useState(item)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(canWrite)
  const [busy, setBusy] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [error, setError] = useState('')
  const ownsLock = useRef(false)
  const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '暂无记录'
  useEffect(() => {
    if (!canWrite) return undefined
    let active = true
    // 延迟到微任务，避免开发环境 StrictMode 的试挂载重复申请和释放同一个锁。
    Promise.resolve().then(async () => {
      if (!active) return
      try {
        await contentApi.lock(module.type, item.id)
        if (!active) { await contentApi.unlock(module.type, item.id); return }
        ownsLock.current = true; setLocked(true)
      } catch (err) { if (active) setError(err.message) }
      finally { if (active) setLoading(false) }
    })
    return () => {
      active = false
      if (ownsLock.current) { ownsLock.current = false; contentApi.unlock(module.type, item.id).catch(() => {}) }
    }
  }, [item.id, module.type, canWrite])
  async function save(event) {
    event.preventDefault()
    if (uploadCount || busy || !locked) return
    setBusy(true); setError('')
    try { await contentApi.saveContent(module.type, item.id, draft); ownsLock.current = false; onSaved() }
    catch (err) { setError(err.message); if (err.status === 423 || err.status === 403) setLocked(false) }
    finally { setBusy(false) }
  }
  const pending = busy || uploadCount > 0
  return <AdminDialog title={`${locked ? '编辑' : '查看'} · ${module.label}`} onClose={onClose} busy={pending} wide>
    <form onSubmit={save}><div className="cms-dialog-body">
      {loading && <p role="status">正在申请编辑锁…</p>}
      {error && <p className="cms-alert error" role="alert">{error}</p>}
      <div className="cms-meta-strip"><span>创建时间：{formatTime(draft.createdAt)}</span><span>更新时间：{formatTime(draft.updatedAt)}</span></div>
      <ContentFields type={module.type} value={draft} onChange={setDraft} disabled={!locked || busy} uploads onBusyChange={(active) => setUploadCount((count) => Math.max(0, count + (active ? 1 : -1)))} />
      {locked && <label className="cms-summary-field">变更说明<input value={draft.changeSummary || ''} onChange={(e) => setDraft({ ...draft, changeSummary: e.target.value })} /></label>}
    </div><footer className="cms-dialog-footer"><button type="button" className="cms-button" disabled={pending} onClick={onClose}>关闭</button>{locked && <button className="cms-button primary" disabled={pending}><Save size={16} />{busy ? '保存中…' : uploadCount ? '等待上传完成…' : '保存并生成版本'}</button>}</footer></form>
  </AdminDialog>
}
