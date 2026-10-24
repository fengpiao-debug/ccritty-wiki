import { useEffect, useState } from 'react'
import { Star, UserRound } from 'lucide-react'
import { guestbookHtml } from './guestbookMarkdown'
import { getGuestbookImage } from './guestbookApi'
import { GuestbookInteractions } from './GuestbookInteractions'

export function GuestbookMarkdown({ children }) {
  // 所有留言入口（草稿预览、本人记录、公开列表、管理员后台）使用相同白名单。
  const html = guestbookHtml(children)
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

function GuestbookImage({ asset, admin }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl
    setUrl(''); setError(false)
    getGuestbookImage(asset.id, admin, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl)
    }).catch(error => { if (error.name !== 'AbortError') setError(true) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [asset.id, admin])
  return url ? <a href={url} target="_blank" rel="noopener noreferrer"><img className={`guestbook-asset ${asset.kind}`} src={url} alt={asset.kind === 'emoji' ? '自定义表情' : '留言图片'} /></a> : <span>{error ? '图片加载失败' : '图片加载中…'}</span>
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`
  if (minutes < 43200) return `${Math.floor(minutes / 1440)} 天前`
  return new Date(value).toLocaleDateString('zh-CN')
}

export function GuestbookCard({ item, mine = false, admin = false, onUpdate, children }) {
  return <article className={admin ? 'guestbook-card' : 'guestbook-comment'}>
    {!admin && <span className="guestbook-anonymous-avatar" aria-hidden="true"><UserRound size={16} /></span>}
    <div className="guestbook-comment-content">
    <header>
      {item.featured && item.status === 'approved' && <span className="guestbook-featured"><Star size={13} fill="currentColor" />精选</span>}
      {(mine || admin) && <span className={`guestbook-status ${item.status}`}>{({ pending: '待审核 · 仅本人可见', approved: '已公开', rejected: '未通过 / 已撤下 · 仅本人可见' })[item.status]}</span>}
      <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('zh-CN')}>{admin ? new Date(item.createdAt).toLocaleString('zh-CN') : relativeTime(item.createdAt)}</time>
    </header>
    <GuestbookMarkdown>{item.markdown}</GuestbookMarkdown>
    {!!item.assets?.length && <div className="guestbook-assets">{item.assets.map(asset => <GuestbookImage key={asset.id} asset={asset} admin={admin} />)}</div>}
    {!admin && item.status === 'approved' && <GuestbookInteractions item={item} onUpdate={onUpdate} />}
    {children}
    </div>
  </article>
}

export function GuestbookPagination({ page, total, onChange, disabled }) {
  if (total <= 10) return null
  return <nav className="guestbook-pagination" aria-label="留言分页">
    <button type="button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
    <span>第 {page} / {Math.max(1, Math.ceil(total / 10))} 页</span>
    <button type="button" disabled={disabled || page * 10 >= total} onClick={() => onChange(page + 1)}>下一页</button>
  </nav>
}
