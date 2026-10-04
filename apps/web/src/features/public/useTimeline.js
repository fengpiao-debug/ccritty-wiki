import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fuzzyMatches, getTimelineTags } from '@artist-wiki/content-types'
import { timelineEntries } from '../../utils/timeline'

export function useTimeline(items, dateField, searchFields, isPinned) {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [params, setParams] = useSearchParams()
  const selectedTag = params.get('tag') || ''
  const setSelectedTag = (tag) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (tag) next.set('tag', tag)
    else next.delete('tag')
    return next
  })
  const tags = [...new Set(items.flatMap(getTimelineTags))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const entries = timelineEntries(items, dateField, sortOrder, isPinned).filter(({ item, dateLabel }) =>
    (!selectedTag || getTimelineTags(item).includes(selectedTag)) && fuzzyMatches([
      ...searchFields.map((field) => typeof field === 'function' ? field(item) : item[field]), ...getTimelineTags(item), item[dateField], dateLabel,
    ], query))

  return { query, setQuery, sortOrder, setSortOrder, entries, tags, selectedTag, setSelectedTag }
}
