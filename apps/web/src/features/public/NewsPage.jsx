// 文件作用：apps/web/src/features/public/NewsPage.jsx，负责公开 Wiki 内容展示。
import { ExternalLink } from 'lucide-react'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { formatDate } from '../../utils/content'

export function NewsPage() {
  const { content, loading } = useContent()
  const datedNews = content.news.map((item) => {
    const timestamp = Date.parse(item.publishedAt)
    return { item, timestamp: Number.isFinite(timestamp) ? timestamp : null }
  }).sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity))
  return (
    <div className="content-page">
      <PageHeading title="动态" subtitle="News & Notes" />
      {loading && <p className="empty-copy" role="status">正在加载动态…</p>}
      {!loading && !datedNews.length && <p className="empty-copy">暂无动态，新的消息将在这里记录。</p>}
      <ol className="news-timeline" aria-label="动态时间线">
        {datedNews.map(({ item, timestamp }) => (
          <li className="news-timeline-item" key={item.id}>
            <time className="news-date" dateTime={timestamp === null ? undefined : item.publishedAt}>{timestamp === null ? '日期待定' : formatDate(item.publishedAt)}</time>
            <span className="news-dot" aria-hidden="true" />
            <article className="news-entry">
              <span className="news-source">{item.sourceName || '站内记录'}</span>
              <h2>{item.title}</h2>
              {item.cover && <a className="news-cover" href={item.cover} target="_blank" rel="noreferrer" aria-label={`查看${item.title}配图原图`}><img src={item.cover} alt={`${item.title}配图`} loading="lazy" /></a>}
              <Markdown>{item.markdown}</Markdown>
              {item.sourceUrl && <a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 <ExternalLink size={14} /></a>}
            </article>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PageHeading({ title, subtitle }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div></header>
}
