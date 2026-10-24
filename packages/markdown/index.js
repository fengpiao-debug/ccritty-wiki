// 正文统一支持 Markdown 表格、邮件链接、列表和图片；不执行原始 HTML。
import MarkdownIt from 'markdown-it'
import { guestbookEmojiMap } from './guestbookEmojis.js'
export { guestbookEmojiMap, guestbookEmojiPack, guestbookEmojiSources, normalizeWalineEmoji } from './guestbookEmojis.js'

const parser = new MarkdownIt({ html: false, breaks: true, linkify: true })
parser.inline.ruler.before('text', 'guestbook_emoji', (state, silent) => {
  if (!state.env?.guestbook || state.src[state.pos] !== ':') return false
  const match = /^:(weibo_[a-z_]+):/.exec(state.src.slice(state.pos))
  if (!match || !guestbookEmojiMap[match[1]]) return false
  if (!silent) {
    const token = state.push('guestbook_emoji', 'img', 0)
    token.content = match[1]
  }
  state.pos += match[0].length
  return true
})
parser.renderer.rules.guestbook_emoji = (tokens, index) => {
  const key = tokens[index].content
  return `<img class="wl-emoji" src="${guestbookEmojiMap[key]}" alt="${key}" loading="lazy">`
}
const renderImage = parser.renderer.rules.image
parser.renderer.rules.image = (tokens, index, options, env, renderer) => {
  if (env?.guestbook) {
    const src = tokens[index].attrGet('src')
    if (Object.hasOwn(env.draftImages || {}, src)) {
      return `<img class="guestbook-asset ${env.draftImages[src] === 'emoji' ? 'emoji' : 'image'}" src="${parser.utils.escapeHtml(src)}" alt="${parser.utils.escapeHtml(tokens[index].content)}">`
    }
    return parser.utils.escapeHtml(tokens[index].content || '图片请通过上传添加')
  }
  tokens[index].attrSet('loading', 'lazy')
  tokens[index].attrSet('decoding', 'async')
  return renderImage(tokens, index, options, env, renderer)
}
const renderLink = parser.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options))
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  if (env?.guestbook) {
    try {
      if (!['http:', 'https:', 'mailto:'].includes(new URL(tokens[index].attrGet('href') || '', 'https://guestbook.invalid').protocol)) {
        tokens[index].attrs = (tokens[index].attrs || []).filter(([key]) => key !== 'href')
      }
    } catch { tokens[index].attrs = (tokens[index].attrs || []).filter(([key]) => key !== 'href') }
  }
  if (/^(?:https?:)?\/\//i.test(tokens[index].attrGet('href') || '')) {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
  }
  return renderLink(tokens, index, options, env, renderer)
}
parser.renderer.rules.table_open = () => '<div class="markdown-table-scroll" role="region" aria-label="表格" tabindex="0"><table>\n'
parser.renderer.rules.table_close = () => '</table></div>\n'

export function renderMarkdown(markdown = '') {
  return parser.render(String(markdown ?? ''))
}

// 留言中的图片统一使用受审核的附件，避免外链图片在审核后被替换。
export function renderGuestbookMarkdown(markdown = '', { draftImages = {} } = {}) {
  return parser.render(String(markdown ?? ''), { guestbook: true, draftImages })
}
