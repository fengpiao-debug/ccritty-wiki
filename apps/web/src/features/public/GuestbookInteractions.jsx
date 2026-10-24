import { useEffect, useState } from 'react'
import { Flag, ThumbsUp } from 'lucide-react'
import { guestbookRequest } from './guestbookApi'

export const reportReasons = { spam: '广告或垃圾信息', abuse: '辱骂或不当内容', copyright: '侵权或隐私问题', other: '其他问题' }

export function GuestbookInteractions({ item, onUpdate }) {
  const [state, setState] = useState(item)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('spam')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { setState(item) }, [item])
  async function act(action) {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await guestbookRequest(`/${encodeURIComponent(item.id)}/${action}`, {
        method: action === 'like' ? 'PUT' : 'POST',
        body: JSON.stringify(action === 'like' ? { liked: !state.liked } : { reason }),
      })
      setState(current => ({ ...current, ...result })); onUpdate?.(item.id, result)
      if (action === 'report') { setReporting(false); setNotice(result.message) }
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <>
    <div className="guestbook-reactions">
      <button type="button" disabled={busy} aria-label={state.liked ? '取消点赞' : '点赞'} aria-pressed={Boolean(state.liked)} onClick={() => act('like')}><ThumbsUp size={14} /><span>{state.liked ? '已赞' : '点赞'}</span><span>{state.likeCount || 0}</span></button>
      <button type="button" disabled={busy || state.reported} aria-expanded={reporting} onClick={() => { setReporting(!reporting); setError('') }}><Flag size={14} /><span>{state.reported ? '已举报' : '举报'}</span></button>
    </div>
    {reporting && <form className="guestbook-report-form" onSubmit={event => { event.preventDefault(); act('report') }}>
      <label>举报原因<select value={reason} disabled={busy} onChange={event => setReason(event.target.value)}>{Object.entries(reportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" disabled={busy}>提交举报</button><button type="button" disabled={busy} onClick={() => setReporting(false)}>取消</button>
    </form>}
    {error && <p className="guestbook-interaction-error" role="alert">{error}</p>}
    {notice && <p className="guestbook-notice" role="status">{notice}</p>}
  </>
}
