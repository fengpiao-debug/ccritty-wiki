// 文件作用：apps/web/src/features/public/NewsPage.jsx，负责公开 Wiki 内容展示。
import { ExternalLink } from 'lucide-react'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { formatDate } from '../../utils/content'

export function NewsPage() {
  const { content } = useContent()
  return (
    <div className="content-page">
      <PageHeading number="03" title="动态" subtitle="News & Notes" />
      <div className="article-list">
        {content.news.map((item) => (
          <article className="article-card" key={item.id}>
            <div className="article-meta"><time>{formatDate(item.publishedAt)}</time><span>{item.sourceName || '站内记录'}</span></div>
            <h2>{item.title}</h2>
            <Markdown>{item.markdown}</Markdown>
            {item.sourceUrl && <a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 <ExternalLink size={14} /></a>}
          </article>
        ))}
      </div>
    </div>
  )
}

export function PageHeading({ number, title, subtitle }) {
  return <header className="page-heading"><span>{number}</span><div><h1>{title}</h1><p>{subtitle}</p></div></header>
}
