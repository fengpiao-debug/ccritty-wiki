import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'
import { GuestbookCard, GuestbookPagination } from '../public/GuestbookCard'
import { reportReasons } from '../public/GuestbookInteractions'
import '../../styles/guestbook.css'

export function GuestbookManagementPage() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [deleteId, setDeleteId] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    apiRequest(`/admin/guestbook?status=${status}&page=${page}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        if (page > 1 && !result.items.length) setPage(page - 1)
        else setData(result)
      }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [status, page, revision])
  async function review(id, nextStatus) {
    return mutate(`/admin/guestbook/${encodeURIComponent(id)}`, 'PATCH', { status: nextStatus })
  }
  async function mutate(path, method, body) {
    setBusy(true); setError('')
    try {
      await apiRequest(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      setDeleteId(null)
      setRevision(value => value + 1)
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <section className="guestbook-admin">
    <h1>留言管理</h1><p>审核后公开，可设置精选、处理举报或删除留言。撤下时自动取消精选。</p>
    <div className="guestbook-tabs">{[['pending', '待审核'], ['approved', '已公开'], ['featured', '精选'], ['reported', '待处理举报'], ['rejected', '未通过 / 已撤下']].map(([value, label]) => <button key={value} disabled={busy} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); setDeleteId(null) }}>{label}</button>)}<button onClick={() => setRevision(value => value + 1)} disabled={busy}>刷新</button></div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">正在加载留言…</p> : <>
      {!data.items.length && <p>暂无此类留言。</p>}
      {data.items.map(item => <GuestbookCard key={item.id} item={item} admin>
        <p className="guestbook-help">{item.likeCount || 0} 次点赞</p>
        {item.reportCount > 0 && <div className="guestbook-report-review">
          <p>{item.reportCount} 条待处理举报：{item.reportReasons?.map(({ reason, total }) => `${reportReasons[reason] || '其他问题'} ${total} 条`).join('；')}</p>
          <button disabled={busy} className="subtle-button" onClick={() => mutate(`/admin/guestbook/${encodeURIComponent(item.id)}/reports`, 'PATCH', { action: 'dismiss' })}>忽略举报</button>
          <button disabled={busy} className="subtle-button guestbook-delete" onClick={() => mutate(`/admin/guestbook/${encodeURIComponent(item.id)}/reports`, 'PATCH', { action: 'withdraw' })}>举报成立并撤下</button>
        </div>}
        {item.reviewedAt && <p className="guestbook-help">审核人：{item.reviewedBy} · {new Date(item.reviewedAt).toLocaleString('zh-CN')}</p>}
        <div className="guestbook-actions">
          {item.status !== 'approved' && <button disabled={busy} className="solid-button" onClick={() => review(item.id, 'approved')}>审核通过</button>}
          {item.status !== 'rejected' && <button disabled={busy} className="subtle-button" onClick={() => review(item.id, 'rejected')}>{item.status === 'approved' ? '撤下留言' : '不予通过'}</button>}
          {item.status === 'approved' && <button disabled={busy} className="subtle-button" onClick={() => mutate(`/admin/guestbook/${encodeURIComponent(item.id)}/featured`, 'PATCH', { featured: !item.featured })}>{item.featured ? '取消精选' : '设为精选'}</button>}
          <button disabled={busy} className="subtle-button guestbook-delete" onClick={() => setDeleteId(item.id)}>删除留言</button>
        </div>
        {deleteId === item.id && <div className="guestbook-delete-confirm" role="group" aria-label="确认删除留言">
          <p>删除后留言及附件会永久移除，本人也无法查看。确认删除？</p>
          <button disabled={busy} className="solid-button" onClick={() => mutate(`/admin/guestbook/${encodeURIComponent(item.id)}`, 'DELETE')}>确认删除</button>
          <button disabled={busy} className="subtle-button" onClick={() => setDeleteId(null)}>取消</button>
        </div>}
      </GuestbookCard>)}
      <GuestbookPagination page={page} total={data.total} onChange={setPage} disabled={busy} />
    </>}
  </section>
}
