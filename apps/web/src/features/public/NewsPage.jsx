// 文件作用：apps/web/src/features/public/NewsPage.jsx，负责公开 Wiki 内容展示。
import { ExternalLink } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getTimelineTags, normalizeNewsKind } from '@artist-wiki/content-types'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { useTimeline } from './useTimeline'
import { TimelineTools, TimelineTags } from './TimelineTools'
import { SearchHighlight } from '../../components/SearchHighlight'

export function NewsPage() {
  const { content, loading } = useContent()
  const timeline = useTimeline(content.news, 'publishedAt', ['title', 'sourceName', 'markdown', 'newsKind'])
  const { query, selectedTag } = timeline
  const [params, setParams] = useSearchParams()
  const selectedKind = normalizeNewsKind(params.get('kind'))
  const setSelectedKind = (kind) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (kind) next.set('kind', kind)
    else next.delete('kind')
    return next
  })
  const kinds = [...new Set([...content.news.map((item) => normalizeNewsKind(item.newsKind)), selectedKind].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const entries = timeline.entries.filter(({ item }) => !selectedKind || normalizeNewsKind(item.newsKind) === selectedKind)
  return (
    <div className="content-page timeline-page">
      <PageHeading title="动态" subtitle="News & Notes" />
      <TimelineTools label="动态" placeholder="搜索标题、正文、来源、日期、标识、标签…" {...timeline}>
        {kinds.length > 0 && <div className="timeline-tag-filter" role="group" aria-label="动态标识筛选">
          <span>标识</span>
          <button type="button" aria-pressed={!selectedKind} onClick={() => setSelectedKind('')}>全部标识</button>
          {kinds.map((kind) => <button type="button" key={kind} aria-pressed={selectedKind === kind} onClick={() => setSelectedKind(kind)}>{kind}</button>)}
        </div>}
      </TimelineTools>
      {loading && <p className="empty-copy" role="status">正在加载动态…</p>}
      {!loading && <p className="album-results timeline-results" role="status">共 {entries.length} 条动态{query.trim() && ' · 搜索结果'}{selectedKind && ` · 标识：${selectedKind}`}{selectedTag && ` · 标签：${selectedTag}`}</p>}
      {!loading && !entries.length && <p className="empty-copy">{selectedKind ? '没有找到匹配的动态，试试其他标识、标签或清空搜索。' : selectedTag ? '没有找到匹配的动态，试试其他标签或清空搜索。' : query.trim() ? '没有找到匹配的动态，试试其他关键词。' : '暂无动态，新的消息将在这里记录。'}</p>}
      <ol className="news-timeline" aria-label="动态时间线">
        {entries.map(({ item, timestamp, dateLabel }) => (
          <li className="news-timeline-item" key={item.id}>
            <time className="news-date" dateTime={timestamp === null ? undefined : item.publishedAt}><SearchHighlight query={query}>{dateLabel}</SearchHighlight></time>
            <span className="news-dot" aria-hidden="true" />
            <article className="news-entry">
              <div className="news-topline">
                <span className="news-source"><SearchHighlight query={query}>{item.sourceName || '站内记录'}</SearchHighlight></span>
                {normalizeNewsKind(item.newsKind) && <button type="button" className="news-kind" aria-label={`动态标识：${normalizeNewsKind(item.newsKind)}`} aria-pressed={selectedKind === normalizeNewsKind(item.newsKind)} title={`查看同标识动态：${normalizeNewsKind(item.newsKind)}`} onClick={() => setSelectedKind(normalizeNewsKind(item.newsKind))}><SearchHighlight query={query}>{normalizeNewsKind(item.newsKind)}</SearchHighlight></button>}
              </div>
              <h2><SearchHighlight query={query}>{item.title}</SearchHighlight></h2>
              <TimelineTags {...timeline} tags={getTimelineTags(item)} />
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
