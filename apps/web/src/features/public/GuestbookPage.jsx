import { useEffect, useState } from 'react'
import { PageHeading } from './NewsPage'
import { guestbookRequest } from './guestbookApi'
import { GuestbookCard, GuestbookPagination } from './GuestbookCard'
import { WalineComposer } from './WalineComposer'
import '../../styles/guestbook.css'

export function GuestbookPage() {
  const [tab, setTab] = useState('public')
  const [sort, setSort] = useState('latest')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setListError('')
    Promise.resolve().then(() => guestbookRequest(`${tab === 'mine' ? '/mine' : ''}?page=${page}&sort=${sort}${tab === 'featured' ? '&featured=1' : ''}`, { signal: controller.signal }))
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(error => { if (!controller.signal.aborted) setListError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tab, page, revision, sort])
  async function submit(markdown, files) {
    setError(''); setNotice('')
    try {
      const body = new FormData()
      body.append('markdown', markdown)
      body.append('kinds', JSON.stringify(files.map(item => item.kind)))
      files.forEach(item => body.append('files', item.file))
      const data = await guestbookRequest('', { method: 'POST', body })
      setNotice('留言已提交，审核通过后将会展示')
      setTab('mine'); setPage(1); setRevision(value => value + 1)
      return data.item
    } catch (error) { setError(error.message); throw error }
  }
  return <div className="content-page guestbook-page">
    <PageHeading title="留言" subtitle="Guestbook" />
    <p className="muted-copy">留下一句想说的话，与同好分享此刻的心情。</p>
    <section className="guestbook-list" aria-label="留言列表">
    <div className="guestbook-list-heading">
      <div className="guestbook-list-summary">
        <div className="guestbook-list-filters">{[['public', '大家的留言'], ['featured', '精选留言'], ['mine', '我的留言']].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { if (tab !== value) setLoading(true); setTab(value); setPage(1) }}>{label}</button>)}</div>
      </div>
      <div className="guestbook-sort" role="group" aria-label="留言排序">{[['hot', '热度'], ['latest', '最新']].map(([value, label]) => <button key={value} type="button" aria-pressed={sort === value} title={`${label}排序，点击重新获取留言`} onClick={() => { setLoading(true); setSort(value); setPage(1); setRevision(current => current + 1) }}>{label}</button>)}</div>
    </div>
    {tab === 'mine' && <p className="guestbook-help">通过当前浏览器识别本人，清除网站数据或更换浏览器后无法找回。</p>}
    {loading ? <p role="status">正在加载留言…</p> : listError ? <p role="alert">{listError}，点击“热度”或“最新”重试。</p> : <>
      {!result.items.length && <p className="empty-copy">{tab === 'mine' ? '你还没有提交留言。' : tab === 'featured' ? '还没有精选留言。' : '还没有公开留言，来留下第一句话吧。'}</p>}
      {result.items.map(item => <GuestbookCard key={item.id} item={item} mine={tab === 'mine'} onUpdate={(id, update) => setResult(current => ({ ...current, items: current.items.map(row => row.id === id ? { ...row, ...update } : row) }))} />)}
      <GuestbookPagination page={page} total={result.total} onChange={setPage} />
    </>}
    </section>
    <WalineComposer onSubmit={submit} />
    {error && <p className="guestbook-submit-error" role="alert">{error}</p>}
    <div className="guestbook-toast-region" role="status" aria-live="polite" aria-atomic="true">{notice && <p className="guestbook-toast">{notice}</p>}</div>
  </div>
}
