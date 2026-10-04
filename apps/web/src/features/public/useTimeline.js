import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fuzzyMatches, normalizeTags } from '@artist-wiki/content-types'
import { timelineEntries } from '../../utils/timeline'

export function useTimeline(items, dateField, searchFields) {
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
  const tags = [...new Set(items.flatMap((item) => normalizeTags(item.tags)))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const entries = timelineEntries(items, dateField, sortOrder).filter(({ item, dateLabel }) =>
    (!selectedTag || normalizeTags(item.tags).includes(selectedTag)) && fuzzyMatches([
      ...searchFields.map((field) => item[field]), ...normalizeTags(item.tags), item[dateField], dateLabel,
    ], query))

  return { query, setQuery, sortOrder, setSortOrder, entries, tags, selectedTag, setSelectedTag }
}
