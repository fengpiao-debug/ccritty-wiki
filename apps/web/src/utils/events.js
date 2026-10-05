import { isPendingEvent } from '@artist-wiki/content-types'

export function isUpcomingEvent(event, now = Date.now()) {
  if (event.status === 'ended' || event.status === 'cancelled') return false
  // 待官宣活动的日期可能尚未确定，或只是拟定日期，以状态为准。
  if (isPendingEvent(event)) return true
  const date = String(event.startsAt || '').trim()
  // 只有日期时保留至当天结束，避免当天的活动在零点就被排除。
  const startsAt = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59.999` : date)
  if (Number.isFinite(startsAt)) return startsAt >= now
  return event.status === 'upcoming' || event.status === 'sold-out'
}
