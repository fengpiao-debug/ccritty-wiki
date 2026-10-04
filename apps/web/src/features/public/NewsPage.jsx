// 文件作用：apps/web/src/features/public/NewsPage.jsx，负责公开 Wiki 内容展示。
import { ExternalLink } from 'lucide-react'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { useTimeline } from './useTimeline'
import { TimelineTools, TimelineTags } from './TimelineTools'
import { SearchHighlight } from '../../components/SearchHighlight'

export function NewsPage() {
  const { content, loading } = useContent()
  const timeline = useTimeline(content.news, 'publishedAt', ['title', 'sourceName', 'markdown'])
  const { entries, query, selectedTag } = timeline
  return (
    <div className="content-page timeline-page">
      <PageHeading title="动态" subtitle="News & Notes" />
      <TimelineTools label="动态" placeholder="搜索标题、正文、来源、日期、标签…" {...timeline} />
      {loading && <p className="empty-copy" role="status">正在加载动态…</p>}
      {!loading && <p className="album-results timeline-results" role="status">共 {entries.length} 条动态{query.trim() && ' · 搜索结果'}{selectedTag && ` · 标签：${selectedTag}`}</p>}
      {!loading && !entries.length && <p className="empty-copy">{selectedTag ? '没有找到匹配的动态，试试其他标签或清空搜索。' : query.trim() ? '没有找到匹配的动态，试试其他关键词。' : '暂无动态，新的消息将在这里记录。'}</p>}
      <ol className="news-timeline" aria-label="动态时间线">
        {entries.map(({ item, timestamp, dateLabel }) => (
          <li className="news-timeline-item" key={item.id}>
            <time className="news-date" dateTime={timestamp === null ? undefined : item.publishedAt}><SearchHighlight query={query}>{dateLabel}</SearchHighlight></time>
            <span className="news-dot" aria-hidden="true" />
            <article className="news-entry">
              <span className="news-source"><SearchHighlight query={query}>{item.sourceName || '站内记录'}</SearchHighlight></span>
              <h2><SearchHighlight query={query}>{item.title}</SearchHighlight></h2>
              <TimelineTags {...timeline} tags={item.tags} />
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
