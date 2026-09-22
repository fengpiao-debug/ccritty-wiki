// 文件作用：apps/web/src/features/public/EventsPage.jsx，负责公开 Wiki 内容展示。
import { MapPin, Ticket } from 'lucide-react'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { formatDate } from '../../utils/content'
import { PageHeading } from './NewsPage'

export function EventsPage() {
  const { content } = useContent()
  return (
    <div className="content-page">
      <PageHeading number="04" title="活动" subtitle="Events & Itinerary" />
      <div className="event-timeline">
        {content.events.map((event) => (
          <article className="event-card" key={event.id}>
            <div className="event-date">{formatDate(event.startsAt)}</div>
            <div className="event-dot"></div>
            <div className="event-body">
              <div className="event-topline"><span className={`status-pill status-${event.status}`}>{event.status === 'upcoming' ? '即将到来' : event.status === 'sold-out' ? '已售罄' : event.status}</span><span>{event.category}</span></div>
              <h2>{event.title}</h2>
              <p className="event-location"><MapPin size={14} />{event.city} · {event.venue}</p>
              <Markdown>{event.markdown}</Markdown>
              {event.ticketUrl && <a className="source-link" href={event.ticketUrl} target="_blank" rel="noreferrer"><Ticket size={14} />购票 / 报名</a>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
