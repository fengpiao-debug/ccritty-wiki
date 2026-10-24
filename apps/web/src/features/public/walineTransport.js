import { normalizeWalineEmoji } from '@artist-wiki/markdown'
import { createId } from '@artist-wiki/content-types'
import { guestbookHtml } from './guestbookMarkdown'

const sessions = new Map()

export function createWalineSession({ submit, getDraft }) {
  const serverURL = `${window.location.origin}/api/guestbook/waline/${createId('editor')}`
  const files = new Map()
  const release = () => { files.forEach(item => URL.revokeObjectURL(item.url)); files.clear() }
  const session = {
    files, submit,
    upload(file) {
      if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw new Error('请选择 PNG、JPG、GIF、WEBP 或 AVIF，单张不超过 2MB')
      if (/[\[\]\r\n<>]/.test(file.name)) throw new Error('图片文件名含特殊符号，请重命名后上传')
      // Removing the Markdown image from the editor also releases its staged file.
      const draft = getDraft()
      for (const [url] of files) if (!draft.includes(url)) { URL.revokeObjectURL(url); files.delete(url) }
      if (files.size >= 4) throw new Error('最多上传 4 张图片或表情')
      const url = URL.createObjectURL(file)
      files.set(url, { file, url, kind: file.type === 'image/gif' ? 'emoji' : 'image' })
      return url
    },
    dispose() { sessions.delete(serverURL); release() },
    release,
  }
  sessions.set(serverURL, session)
  return { serverURL, ...session }
}

export function walineDraftImages() {
  return Object.fromEntries([...sessions.values()].flatMap(session => [...session.files].map(([url, item]) => [url, item.kind])))
}

// The site renders its existing list, filters, reports, and private previews.
// Waline owns the composer; its internal list is deliberately empty and hidden.
export async function getComment({ serverURL }) {
  // The site's own list is rendered outside Waline. The client may request its
  // internal list during mount after a StrictMode probe has released a session,
  // so this intentionally remains a stateless empty response.
  return { data: [], count: 0, totalPages: 0, page: 1 }
}

export async function addComment({ serverURL, comment }) {
  const session = sessions.get(serverURL)
  if (!session) throw new Error('留言编辑器已关闭，请刷新重试')
  if (comment.pid || comment.rid) throw new Error('留言板不支持回复')
  const attachments = new Map()
  const markdown = normalizeWalineEmoji(comment.comment).replace(/!\[[^\]\r\n]*\]\((blob:[^)\s]+)\)/g, (_match, url) => {
    const item = session.files.get(url)
    if (!item) throw new Error('图片草稿已失效，请重新上传')
    attachments.set(url, item)
    return ''
  }).trim()
  if (markdown.includes('blob:')) throw new Error('图片格式不完整，请删除图片标记后重新上传')
  if (markdown.length > 5000 || (!markdown && !attachments.size)) throw new Error('请填写留言（最多 5000 字），也可仅上传图片或表情')
  // No nick, mail, login token, or user-agent is forwarded to the anonymous API.
  const item = await session.submit(markdown, [...attachments.values()])
  session.release()
  return { errno: 0, data: {
    objectId: item.id, comment: guestbookHtml(item.markdown), orig: item.markdown,
    status: 'waiting', time: item.createdAt, nick: '', children: [], like: 0,
  } }
}

// These Waline features are not part of this anonymous guestbook. Fail closed
// even if a future client version accidentally exposes one of their controls.
const unavailable = async () => { throw new Error('此留言板未启用该操作') }
export const deleteComment = unavailable
export const updateComment = unavailable
export const login = unavailable
export const getArticleCounter = unavailable
export const updateArticleCounter = unavailable
export const fetchCommentCount = unavailable
export const getPageview = unavailable
export const updatePageview = unavailable
export const getRecentComment = unavailable
export const getUserList = unavailable
