// 文件作用：编辑者按授权栏目浏览内容表格，分离查看、编辑、删除与版本操作，避免全内容堆叠。
import { useCallback, useEffect, useState } from 'react'
import { Eye, History, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { ContentEditorDialog } from './ContentEditorDialog'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { AdminDialog } from './AdminDialog'
import { createId } from '@artist-wiki/content-types'

export function ContentManagementPage({ module }) {
  const auth = useAuth()
  const canWrite = auth.can(`${module.scope}.write`)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [history, setHistory] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const content = await contentApi.getAdminContent()
      const collection = content[module.key]
      setItems(Array.isArray(collection) ? collection : collection ? [collection] : [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }, [module.key])
  useEffect(() => { reload() }, [reload])
  const visible = items.filter((item) => (filter === 'all' || (filter === 'deleted' ? !!item.deletedAt : !item.deletedAt)) && (item.title || item.artistName || '').includes(query))
  const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
  async function remove() {
    setBusy(true); setError('')
    let locked = false
    try {
      await contentApi.lock(module.type, deleting.id); locked = true
      await contentApi.deleteContent(module.type, deleting.id)
      setNotice('内容已删除，历史版本保留'); setDeleting(null); await reload()
    } catch (err) { setError(err.message) }
    finally { if (locked) await contentApi.unlock(module.type, deleting.id).catch(() => {}); setBusy(false) }
  }
  return <>
    <div className="cms-page-heading"><div><h1>{module.label}</h1><p>内容管理 / {module.label}</p></div>{canWrite && module.type !== 'profile' && <button className="cms-button primary" onClick={() => setEditing({ id: createId(module.type), type: module.type, title: '' })}><Plus size={17} />新增内容</button>}</div>
    {error && !deleting && <p className="cms-alert error" role="alert">{error}</p>}
    {notice && <p className="cms-alert success" role="status">{notice}</p>}
    <section className="cms-registry">
      <div className="cms-section-title"><h2>内容列表 <span>{items.length}</span></h2><span className={`cms-badge ${canWrite ? 'green' : 'neutral'}`}>{canWrite ? '可编辑' : '只读'}</span></div>
      <div className="cms-toolbar"><label className="cms-search"><Search size={17} /><input aria-label="搜索内容" placeholder="搜索标题" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select aria-label="筛选内容状态" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="active">正常内容</option><option value="deleted">已删除</option><option value="all">全部状态</option></select><button className="cms-icon" title="刷新内容" aria-label="刷新内容" disabled={loading} onClick={reload}><RefreshCw size={17} /></button></div>
      <div className="cms-table-scroll"><table className="cms-table"><thead><tr><th>标题</th><th>内容编号</th><th>更新时间</th><th>状态</th><th>操作</th></tr></thead><tbody>
        {!loading && visible.map((item) => <tr key={item.id}><td><strong>{item.title || item.artistName || '未命名'}</strong>{item.artist && <small>{item.artist}</small>}</td><td className="cms-muted">{item.id}</td><td className="cms-muted">{formatTime(item.updatedAt)}</td><td><span className={`cms-badge ${item.deletedAt ? 'neutral' : 'green'}`}>{item.deletedAt ? '已删除' : '正常'}</span></td><td><div className="cms-row-actions">
          {!item.deletedAt && <button className="cms-icon" title={canWrite ? '编辑' : '查看'} aria-label={`${canWrite ? '编辑' : '查看'} ${item.title || item.artistName}`} onClick={() => setEditing(item)}>{canWrite ? <Pencil size={16} /> : <Eye size={16} />}</button>}
          {auth.can('content.rollback') && <button className="cms-icon" title="历史版本" aria-label="历史版本" onClick={() => setHistory(item)}><History size={16} /></button>}
          {canWrite && !item.deletedAt && module.type !== 'profile' && <button className="cms-icon danger" title="删除" aria-label={`删除 ${item.title}`} onClick={() => { setError(''); setDeleting(item) }}><Trash2 size={16} /></button>}
        </div></td></tr>)}
        {(loading || !visible.length) && <tr><td colSpan={5} className="cms-table-empty">{loading ? '正在加载内容…' : '暂无匹配的内容'}</td></tr>}
      </tbody></table></div>
      <div className="cms-pagination"><span>共 {visible.length} 条内容</span></div>
    </section>
    {editing && <ContentEditorDialog item={editing} module={module} canWrite={canWrite} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('内容已保存，历史版本已生成'); reload() }} />}
    {history && <VersionHistoryPanel item={history} module={module} canWrite={canWrite} onClose={() => setHistory(null)} onRestored={() => { setHistory(null); setNotice('已恢复为新版本'); reload() }} />}
    {deleting && <AdminDialog title="删除内容" onClose={() => setDeleting(null)} busy={busy}><div className="cms-dialog-body"><p>确认删除「{deleting.title}」？历史版本将保留。</p>{error && <p className="cms-alert error" role="alert">{error}</p>}</div><footer className="cms-dialog-footer"><button className="cms-button" disabled={busy} onClick={() => setDeleting(null)}>取消</button><button className="cms-button danger" disabled={busy} onClick={remove}>确认删除</button></footer></AdminDialog>}
  </>
}
