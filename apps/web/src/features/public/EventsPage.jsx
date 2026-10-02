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
      <PageHeading title="活动" subtitle="Events & Itinerary" />
      <div className="event-timeline">
        {content.events.map((event) => (
          <article className="event-card" key={event.id}>
            <time className="event-date" dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
            <div className="event-dot" aria-hidden="true"></div>
            <div className="event-body">
              {(event.status || event.category) && <div className="event-topline">
                {event.status && <span className={'status-pill status-' + event.status}>{event.status === 'upcoming' ? '即将到来' : event.status === 'sold-out' ? '已售罄' : event.status}</span>}
                {event.category && <span className="event-category">{event.category}</span>}
              </div>}
              <div className={`event-content${event.cover ? ' has-cover' : ''}`}>
                <div className="event-copy">
                  <h2>{event.title}</h2>
                  <p className="event-location"><MapPin size={14} />{event.city} · {event.venue}</p>
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
