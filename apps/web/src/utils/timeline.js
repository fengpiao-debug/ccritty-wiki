import { formatDate } from './content'

export function timelineEntries(items, dateField, sortOrder = 'desc') {
  return items.map((item) => {
    const parsed = Date.parse(item[dateField])
    const timestamp = Number.isFinite(parsed) ? parsed : null
    return { item, timestamp, dateLabel: timestamp === null ? '日期待定' : formatDate(item[dateField]) }
  }).sort((a, b) => {
    if (a.timestamp === null) return b.timestamp === null ? 0 : 1
    if (b.timestamp === null) return -1
    return sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  })
}
