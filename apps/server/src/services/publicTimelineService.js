import { eventStatusLabel, fuzzyMatches, getTimelineTags, isPendingEvent, normalizeNewsKind, timelineEntries } from '@artist-wiki/content-types'

export function publicTimelinePage(records, type, { q = '', tag = '', kind = '', sort = 'desc', timeZone = 'Asia/Shanghai', offset = 0, limit = 12 } = {}) {
  const items = (records || []).filter((item) => !item.deletedAt)
  const isNews = type === 'news'
  const dateField = isNews ? 'publishedAt' : 'startsAt'
  const tags = [...new Set(items.flatMap(getTimelineTags))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const kinds = isNews ? [...new Set(items.map((item) => normalizeNewsKind(item.newsKind)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')) : []
  const entries = timelineEntries(items, dateField, sort, isNews ? undefined : isPendingEvent, timeZone).filter(({ item, dateLabel }) => {
    if (tag && !getTimelineTags(item).includes(tag)) return false
    if (isNews && kind && normalizeNewsKind(item.newsKind) !== kind) return false
    const fields = isNews ? [item.title, item.sourceName, item.markdown, item.newsKind] : [item.title, item.city, item.venue, item.category, item.markdown, eventStatusLabel(item.status)]
    return fuzzyMatches([...fields, ...getTimelineTags(item), item[dateField], dateLabel], q)
  })
  const page = entries.slice(offset, offset + limit)
  return { entries: page, total: entries.length, nextOffset: offset + page.length < entries.length ? offset + page.length : null, tags, kinds }
}
