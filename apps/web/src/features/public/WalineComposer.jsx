import { useEffect, useRef, useState } from 'react'
import { guestbookEmojiPack } from '@artist-wiki/markdown'
import { createWalineSession } from './walineTransport'
import '@waline/client/style'

export function WalineComposer({ onSubmit }) {
  const host = useRef(null)
  const submit = useRef(onSubmit)
  submit.current = onSubmit
  const [state, setState] = useState('loading')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let disposed = false
    let instance
    const session = createWalineSession({
      submit: (...args) => submit.current(...args),
      getDraft: () => host.current?.querySelector('textarea')?.value || '',
    })
    setState('loading')
    import('@waline/client').then(({ init }) => {
      if (disposed) return
      instance = init({
        el: host.current, serverURL: session.serverURL, path: '/guestbook',
        lang: 'zh-CN', login: 'disable', meta: [], requiredMeta: [],
        wordLimit: 5000, emoji: [guestbookEmojiPack], search: false,
        // The scoped Markdown adapter handles preview sanitization. Omit these
        // optional function props instead of passing booleans to Vue components.
        reaction: false,
        noRss: true, noCopyright: false,
        imageUploader: file => Promise.resolve().then(() => session.upload(file)),
        locale: { placeholder: '请留言。无需昵称，审核通过后公开。', submit: '提交留言', preview: '预览', uploadImage: '上传图片或表情' },
      })
      const editor = host.current.querySelector('textarea')
      editor?.setAttribute('aria-label', '留言内容')
      editor?.setAttribute('maxlength', '5000')
      host.current.querySelector('input[type="file"]')?.setAttribute('accept', 'image/png,image/jpeg,image/gif,image/webp,image/avif')
      setState('ready')
    }).catch(error => {
      if (!disposed) { console.error('Waline editor failed to load:', error); setState('error') }
    })
    return () => { disposed = true; instance?.destroy(); session.dispose() }
  }, [revision])
  return <div className="guestbook-composer waline-composer">
    {state === 'loading' && <p role="status">正在加载留言编辑器…</p>}
    {state === 'error' && <p role="alert">编辑器加载失败。<button type="button" onClick={() => setRevision(value => value + 1)}>重试</button></p>}
    <div ref={host} />
    <p className="guestbook-help">匿名留言 · 审核通过后公开，审核前仅本人可预览。最多 5000 字，4 张图片或表情，单张 2MB。</p>
  </div>
}
