import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { addComment, createWalineSession, login, updateComment } from './walineTransport'
import { Marked } from './walineMarkdown'
import { guestbookHtml } from './guestbookMarkdown'

let session
let draft
let submit
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
beforeEach(() => {
  draft = ''
  URL.createObjectURL = vi.fn(() => `blob:http://localhost/${crypto.randomUUID()}`)
  URL.revokeObjectURL = vi.fn()
  submit = vi.fn(async markdown => ({ id: 'message-1', markdown, createdAt: '2026-10-24T12:00:00Z' }))
  session = createWalineSession({ submit, getDraft: () => draft })
})
afterEach(() => { session.dispose(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; vi.unstubAllGlobals() })
const image = () => new File(['image'], 'photo.png', { type: 'image/png' })

it('initializes on HTTP deployments without crypto.randomUUID', () => {
  session.dispose()
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  session = createWalineSession({ submit, getDraft: () => '' })
  expect(session.serverURL).toMatch(/\/waline\/editor-[a-f0-9-]+$/)
})

it('keeps uploads local until submission, forwards only selected files and strips identity metadata', async () => {
  const file = image()
  const url = session.upload(file)
  expect(submit).not.toHaveBeenCalled()
  const result = await addComment({ serverURL: session.serverURL, token: 'ignore', comment: {
    nick: 'ignore', mail: 'ignore@example.com', ua: 'ignore',
    comment: `你好 :weibo_smile: ![photo](${url})`,
  } })
  expect(result.data.status).toBe('waiting')
  expect(submit).toHaveBeenCalledWith('你好 :weibo_smile:', [{ file, url, kind: 'image' }])
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  expect(session.files.size).toBe(0)
})

it('only normalizes exact local Waline emoji tags, and sanitizes every preview', async () => {
  const valid = '<img class="wl-emoji" src="/waline-emojis/weibo/weibo_smile.png" alt="weibo_smile">'
  await addComment({ serverURL: session.serverURL, comment: { comment: valid } })
  expect(submit).toHaveBeenCalledWith(':weibo_smile:', [])
  const preview = new Marked().parse(valid + '<img src=x onerror="alert(1)"><script>alert(1)</script>')
  const root = document.createElement('div'); root.innerHTML = preview
  expect(root.querySelectorAll('img')).toHaveLength(1)
  expect(root.querySelector('img').getAttribute('src')).toBe('/waline-emojis/weibo/weibo_smile.png')
  expect(root.querySelector('script, [onerror]')).toBeNull()
  expect(guestbookHtml('![external](https://example.com/track.png)')).not.toContain('<img')
})

it('allows only this mounted composer’s known blobs in preview, never arbitrary blob URLs', () => {
  const url = session.upload(image())
  const html = new Marked().parse(`![photo](${url}) ![unknown](blob:http://localhost/unknown)`)
  const root = document.createElement('div'); root.innerHTML = html
  expect(root.querySelectorAll('img')).toHaveLength(1)
  expect(root.querySelector('img').getAttribute('src')).toBe(url)
  expect(guestbookHtml(`![photo](${url})`)).not.toContain('<img')
})

it('retains files after network failure so submitting again works', async () => {
  const url = session.upload(image())
  submit.mockRejectedValueOnce(new Error('offline'))
  const request = { serverURL: session.serverURL, comment: { comment: `![photo](${url})` } }
  await expect(addComment(request)).rejects.toThrow('offline')
  expect(session.files.has(url)).toBe(true)
  await addComment(request)
  expect(session.files.size).toBe(0)
})

it('enforces attachment limits and frees removed draft images before uploading replacements', () => {
  for (let i = 0; i < 4; i++) { const url = session.upload(image()); draft += `![photo](${url})` }
  expect(() => session.upload(image())).toThrow('最多上传 4')
  draft = ''
  expect(() => session.upload(image())).not.toThrow()
  expect(session.files.size).toBe(1)
  expect(() => session.upload(new File(['svg'], 'bad.svg', { type: 'image/svg+xml' }))).toThrow('请选择')
  expect(() => session.upload(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png'))).toThrow('2MB')
})

it('rejects stale uploads, replies, login and editing through the client adapter', async () => {
  await expect(addComment({ serverURL: session.serverURL, comment: { comment: '![stale](blob:http://localhost/stale)' } })).rejects.toThrow('草稿已失效')
  await expect(addComment({ serverURL: session.serverURL, comment: { comment: 'reply', pid: '1' } })).rejects.toThrow('不支持回复')
  await expect(login()).rejects.toThrow('未启用')
  await expect(updateComment()).rejects.toThrow('未启用')
  session.dispose()
  await expect(addComment({ serverURL: session.serverURL, comment: { comment: 'closed' } })).rejects.toThrow('已关闭')
})
