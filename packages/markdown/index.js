// 正文统一支持 Markdown 表格、邮件链接、列表和图片；不执行原始 HTML。
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false, breaks: true, linkify: true })
const renderImage = parser.renderer.rules.image
parser.renderer.rules.image = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('loading', 'lazy')
  tokens[index].attrSet('decoding', 'async')
  return renderImage(tokens, index, options, env, renderer)
}
const renderLink = parser.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options))
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
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
