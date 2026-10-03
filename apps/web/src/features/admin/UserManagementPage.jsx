// 文件作用：管理员专用账号列表，提供搜索、角色筛选、分页和账号授权，不加载任何内容编辑数据。
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users, UserCheck } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { UserEditorDialog } from './UserEditorDialog'
import { AdminDialog } from './AdminDialog'
import { permissionGroups } from './adminModules'
import { SearchHighlight } from '../../components/SearchHighlight'

export function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try { setUsers((await contentApi.users()).items) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  const filtered = users.filter((user) => (!role || user.role === role) && `${user.username} ${user.displayName}`.toLowerCase().includes(query.toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pages)
  const editors = users.filter((user) => user.role !== 'admin')
  async function remove() {
    setBusy(true); setError('')
    try { await contentApi.deleteUser(deleting.id); setDeleting(null); setNotice('账号已删除'); await reload() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <>
    <div className="cms-page-heading"><div><h1>账号与权限</h1><p>系统管理 / 用户访问控制</p></div><button className="cms-button primary" onClick={() => { setNotice(''); setEditor({}) }}><Plus size={17} />新增编辑者</button></div>
    <div className="cms-metrics">
      <div><span className="cms-metric-icon"><Users size={21} /></span><div><span>全部账号</span><strong>{loading ? '—' : users.length}</strong></div></div>
      <div><span className="cms-metric-icon green"><UserCheck size={21} /></span><div><span>编辑者</span><strong>{loading ? '—' : editors.length}</strong></div></div>
      <div><span className="cms-metric-icon amber"><ShieldCheck size={21} /></span><div><span>待分配权限</span><strong>{loading ? '—' : editors.filter((user) => !user.permissions.length).length}</strong></div></div>
    </div>
    {error && !deleting && <p role="alert" className="cms-alert error">{error}</p>}
    {notice && <p role="status" className="cms-alert success">{notice}</p>}
    <section className="cms-registry">
      <div className="cms-section-title"><h2>账号列表 <span>{users.length}</span></h2><span className="cms-muted">管理员 · 仅账号管理</span></div>
      <div className="cms-toolbar">
        <label className="cms-search"><Search size={17} /><input aria-label="搜索账号" placeholder="搜索账号或名称" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} /></label>
        <select aria-label="筛选角色" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}><option value="">全部角色</option><option value="admin">管理员</option><option value="editor">编辑者</option></select>
        <button className="cms-icon" aria-label="刷新账号" title="刷新账号" disabled={loading} onClick={reload}><RefreshCw size={17} /></button>
      </div>
      <div className="cms-table-scroll"><table className="cms-table">
        <thead><tr><th>账号</th><th>角色</th><th>负责模块</th><th>附加权限</th><th>操作</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="cms-table-empty">正在加载账号…</td></tr> : filtered.slice((current - 1) * 10, current * 10).map((user) => <tr key={user.id}>
          <td><div className="cms-user-cell"><span className={`cms-avatar${user.role === 'admin' ? '' : ' editor'}`}>{user.displayName.slice(0, 1)}</span><div><strong><SearchHighlight query={query}>{user.displayName}</SearchHighlight></strong><small><SearchHighlight query={query}>{user.username}</SearchHighlight></small></div></div></td>
          <td><span className={`cms-badge ${user.role === 'admin' ? 'blue' : 'neutral'}`}>{user.role === 'admin' ? '管理员' : '编辑者'}</span></td>
          <td><div className="cms-tags">{user.role === 'admin' ? <span className="cms-muted">账号与权限管理</span> : permissionGroups.filter((g) => user.permissions.includes(`${g.scope}.read`)).map((g) => <span key={g.scope} className="cms-badge green">{g.label} · {user.permissions.includes(`${g.scope}.write`) ? '编辑' : '只读'}</span>)}{user.role !== 'admin' && !user.permissions.some((p) => p.endsWith('.read')) && <span className="cms-muted">未分配</span>}</div></td>
          <td><div className="cms-tags">{user.permissions.includes('content.publish') && <span className="cms-badge neutral">发布</span>}{user.permissions.includes('content.rollback') && <span className="cms-badge amber">回滚</span>}{!user.permissions.some((p) => p.startsWith('content.')) && <span className="cms-muted">—</span>}</div></td>
          <td>{user.role === 'admin' ? <span className="cms-muted">系统账号</span> : <div className="cms-row-actions"><button className="cms-icon" title="编辑权限" aria-label={`编辑 ${user.username} 的权限`} onClick={() => setEditor(user)}><Pencil size={16} /></button><button className="cms-icon danger" title="删除账号" aria-label={`删除 ${user.username}`} onClick={() => { setError(''); setDeleting(user) }}><Trash2 size={16} /></button></div>}</td>
        </tr>)}{!loading && !filtered.length && <tr><td colSpan={5} className="cms-table-empty">没有匹配的账号</td></tr>}</tbody>
      </table></div>
      <div className="cms-pagination"><span>共 {filtered.length} 个账号 · 每页 10 条</span><div><button className="cms-icon" aria-label="上一页" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button><span>{current} / {pages}</span><button className="cms-icon" aria-label="下一页" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
    {editor && <UserEditorDialog user={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('账号与权限已保存'); reload() }} />}
    {deleting && <AdminDialog title="删除账号" onClose={() => setDeleting(null)} busy={busy}><div className="cms-dialog-body"><p>确定删除账号「{deleting.username}」？该账号将无法继续登录，历史内容版本仍会保留。</p>{error && <p role="alert" className="cms-alert error">{error}</p>}</div><footer className="cms-dialog-footer"><button className="cms-button" disabled={busy} onClick={() => setDeleting(null)}>取消</button><button className="cms-button danger" disabled={busy} onClick={remove}>{busy ? '删除中…' : '确认删除'}</button></footer></AdminDialog>}
  </>
}
