// 文件作用：独立历史版本窗口，先加载并预览历史快照，再申请锁恢复；恢复保留原有历史。
import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { ContentFields } from './ContentFields'

export function VersionHistoryPanel({ item, module, canWrite, onClose, onRestored }) {
  const [versions, setVersions] = useState([])
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    contentApi.getVersions(module.type, item.id).then((data) => { if (active) setVersions(data.items) })
      .catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [module.type, item.id])
  async function select(version) {
    setBusy(true); setError(''); setPreview(null); setSelected(version)
    try { setPreview((await contentApi.getVersion(module.type, item.id, version.id)).item) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function restore() {
    setBusy(true); setError('')
    let locked = false
    try {
      await contentApi.lock(module.type, item.id); locked = true
      await contentApi.restoreVersion(module.type, item.id, selected.id)
      onRestored()
    } catch (err) { setError(err.message) }
    finally { if (locked) await contentApi.unlock(module.type, item.id).catch(() => {}); setBusy(false) }
  }
  return <AdminDialog title={`历史版本 · ${item.title || item.artistName}`} wide busy={busy} onClose={onClose}>
    <div className="cms-dialog-body">
      {error && <p className="cms-alert error" role="alert">{error}</p>}
      <div className="cms-table-scroll"><table className="cms-table"><thead><tr><th>版本</th><th>操作者</th><th>时间</th><th>变更说明</th><th>操作</th></tr></thead><tbody>
        {versions.map((version) => <tr key={version.id}><td>v{version.versionNo}</td><td>{version.createdBy}</td><td>{new Date(version.createdAt).toLocaleString('zh-CN')}</td><td>{version.changeSummary}</td><td><button className="cms-link-button" disabled={busy} onClick={() => select(version)}>预览</button></td></tr>)}
        {!versions.length && <tr><td colSpan={5} className="cms-table-empty">{loading ? '正在加载…' : '暂无历史版本'}</td></tr>}
      </tbody></table></div>
      {preview && <section className="cms-version-preview"><h3>v{selected.versionNo} 内容预览</h3><ContentFields type={module.type} value={preview} disabled />{preview.deletedAt && <p className="cms-alert error">此版本为删除状态</p>}</section>}
    </div><footer className="cms-dialog-footer"><button className="cms-button" disabled={busy} onClick={onClose}>关闭</button>{preview && canWrite && <button className="cms-button primary" disabled={busy} onClick={restore}><RotateCcw size={16} />确认恢复 v{selected.versionNo}</button>}</footer>
  </AdminDialog>
}
