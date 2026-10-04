import { formatDate } from './content'

export function timelineEntries(items, dateField, sortOrder = 'desc', isPinned = () => false) {
  return items.map((item) => {
    const parsed = Date.parse(item[dateField])
    const timestamp = Number.isFinite(parsed) ? parsed : null
    return { item, timestamp, dateLabel: timestamp === null ? '日期待定' : formatDate(item[dateField]) }
  }).sort((a, b) => {
    const priority = Number(isPinned(b.item)) - Number(isPinned(a.item))
    if (priority) return priority
    if (a.timestamp === null) return b.timestamp === null ? 0 : 1
    if (b.timestamp === null) return -1
    return sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  })
}
