// 文件作用：apps/web/src/features/public/Markdown.jsx，负责公开 Wiki 内容展示。
import { renderMarkdown } from '@artist-wiki/markdown'

export function Markdown({ children = '' }) {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />
}
