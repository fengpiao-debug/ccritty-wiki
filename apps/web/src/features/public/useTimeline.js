import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeNewsKind } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'

const emptyPage = { entries: [], total: 0, nextOffset: null, tags: [], kinds: [], loading: true, error: '' }

export function useTimeline(type) {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [params, setParams] = useSearchParams()
  const selectedTag = params.get('tag') || ''
  const selectedKind = type === 'news' ? normalizeNewsKind(params.get('kind')) : ''
  const setFilter = (name, value) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set(name, value)
    else next.delete(name)
    return next
  })
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const requestKey = JSON.stringify({ type, q: query.trim(), sort: sortOrder, tag: selectedTag, kind: selectedKind, timeZone })
  const [page, setPage] = useState(emptyPage)
  const sessionRef = useRef(null)

  useEffect(() => {
    const { type: collection, ...filters } = JSON.parse(requestKey)
    const controller = new AbortController()
    const session = { key: requestKey, busy: false, nextOffset: 0, loaded: false, disposed: false }
    sessionRef.current = session
    setPage((previous) => ({ ...emptyPage, key: requestKey, tags: previous.tags, kinds: previous.kinds }))

    session.load = async () => {
      if (session.busy || session.disposed || session.nextOffset === null) return
      session.busy = true
      setPage((previous) => ({ ...previous, loading: true, error: '' }))
      try {
        const result = await contentApi.getTimeline(collection, { ...filters, offset: session.nextOffset, limit: 12 }, controller.signal)
        if (session.disposed) return
        const append = session.loaded
        session.nextOffset = result.nextOffset
        session.loaded = true
        setPage((previous) => {
          const seen = new Set(append ? previous.entries.map(({ item }) => item.id) : [])
          const entries = append ? [...previous.entries, ...result.entries.filter(({ item }) => !seen.has(item.id))] : result.entries
          return { ...result, entries, key: requestKey, loading: false, error: '' }
        })
      } catch (error) {
        if (!session.disposed) setPage((previous) => ({ ...previous, loading: false, error: error.message || '加载失败，请重试。' }))
      } finally { session.busy = false }
    }

    // 输入搜索词时合并短时间内的请求，筛选变化会取消上一轮加载。
    const timer = setTimeout(session.load, filters.q ? 250 : 0)
    return () => {
      session.disposed = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [requestKey])

  const loadMore = useCallback(() => {
    const session = sessionRef.current
    if (session?.key === requestKey) session.load()
  }, [requestKey])
  const current = page.key === requestKey
  const entries = current ? page.entries : []
  return {
    query, setQuery, sortOrder, setSortOrder, selectedTag, selectedKind,
    setSelectedTag: (tag) => setFilter('tag', tag),
    setSelectedKind: (kind) => setFilter('kind', kind),
    entries, total: current ? page.total : 0, tags: page.tags, kinds: page.kinds,
    loading: !current || (page.loading && entries.length === 0),
    loadingMore: current && page.loading && entries.length > 0,
    error: current ? page.error : '',
    hasMore: current && page.nextOffset !== null,
    loadMore,
  }
}
