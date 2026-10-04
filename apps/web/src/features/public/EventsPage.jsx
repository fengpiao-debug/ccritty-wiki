// 文件作用：apps/web/src/features/public/EventsPage.jsx，负责公开 Wiki 内容展示。
import { MapPin, Ticket } from 'lucide-react'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { PageHeading } from './NewsPage'
import { useTimeline } from './useTimeline'
import { TimelineTools, TimelineTags } from './TimelineTools'
import { SearchHighlight } from '../../components/SearchHighlight'

export function EventsPage() {
  const { content, loading } = useContent()
  const timeline = useTimeline(content.events, 'startsAt', ['title', 'city', 'venue', 'category', 'markdown'])
  const { entries, query, selectedTag } = timeline
  return (
    <div className="content-page timeline-page">
      <PageHeading title="活动" subtitle="Events & Itinerary" />
      <TimelineTools label="活动" placeholder="搜索标题、城市、场地、正文、日期、标签…" {...timeline} />
      {loading && <p className="empty-copy" role="status">正在加载活动…</p>}
      {!loading && <p className="album-results timeline-results" role="status">共 {entries.length} 场活动{query.trim() && ' · 搜索结果'}{selectedTag && ` · 标签：${selectedTag}`}</p>}
      {!loading && !entries.length && <p className="empty-copy">{selectedTag ? '没有找到匹配的活动，试试其他标签或清空搜索。' : query.trim() ? '没有找到匹配的活动，试试其他关键词。' : '暂无活动，新的行程将在这里记录。'}</p>}
      <div className="event-timeline">
        {entries.map(({ item: event, timestamp, dateLabel }) => (
          <article className="event-card" key={event.id}>
            <time className="event-date" dateTime={timestamp === null ? undefined : event.startsAt}><SearchHighlight query={query}>{dateLabel}</SearchHighlight></time>
            <div className="event-dot" aria-hidden="true"></div>
            <div className="event-body">
              {(event.status || event.category) && <div className="event-topline">
                {event.status && <span className={'status-pill status-' + event.status}>{event.status === 'upcoming' ? '即将到来' : event.status === 'sold-out' ? '已售罄' : event.status}</span>}
                {event.category && <span className="event-category"><SearchHighlight query={query}>{event.category}</SearchHighlight></span>}
              </div>}
              <div className={`event-content${event.cover ? ' has-cover' : ''}`}>
                <div className="event-copy">
                  <h2><SearchHighlight query={query}>{event.title}</SearchHighlight></h2>
                  <TimelineTags {...timeline} tags={event.tags} />
                  <p className="event-location"><MapPin size={14} /><span><SearchHighlight query={query}>{[event.city, event.venue].filter(Boolean).join(' · ')}</SearchHighlight></span></p>
                  <Markdown>{event.markdown}</Markdown>
                  {event.ticketUrl && <a className="source-link" href={event.ticketUrl} target="_blank" rel="noreferrer"><Ticket size={14} />购票 / 报名</a>}
                </div>
                {event.cover && <a className="event-cover" href={event.cover} target="_blank" rel="noreferrer" aria-label={`查看${event.title}海报原图`}><img src={event.cover} alt={`${event.title}海报`} loading="lazy" /></a>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
