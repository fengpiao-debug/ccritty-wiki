import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { normalizeTags } from '@artist-wiki/content-types'
import { SearchHighlight } from '../../components/SearchHighlight'

export function TimelineTools({ label, placeholder, query, setQuery, sortOrder, setSortOrder, tags, selectedTag, setSelectedTag }) {
  const newestFirst = sortOrder === 'desc'
  const SortIcon = newestFirst ? ArrowDown : ArrowUp
  return <div className="timeline-controls">
    <div className="album-tools timeline-tools">
      <div role="group" aria-label={`${label}时间排序`}>
        <button type="button" className="timeline-sort-toggle" title={`点击切换为${newestFirst ? '最早在前' : '最新在前'}`} onClick={() => setSortOrder((current) => current === 'desc' ? 'asc' : 'desc')}>
          <SortIcon size={16} aria-hidden="true" />
          <span>{newestFirst ? '最新' : '最早'}</span>
        </button>
      </div>
      <label className="album-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label={`搜索${label}`} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button type="button" className="album-icon" aria-label={`清空${label}搜索`} onClick={() => setQuery('')}><X size={16} /></button>}
      </label>
    </div>
    {(tags.length > 0 || selectedTag) && <div className="timeline-tag-filter" role="group" aria-label={`${label}标签筛选`}>
      <span>标签</span>
      <button type="button" aria-pressed={!selectedTag} onClick={() => setSelectedTag('')}>全部标签</button>
      {[...new Set([...tags, ...(selectedTag ? [selectedTag] : [])])].map((tag) => <button type="button" key={tag} aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}>{tag}</button>)}
      {selectedTag && <Link className="timeline-related" to={{ pathname: label === '动态' ? '/events' : '/news', search: `?${new URLSearchParams({ tag: selectedTag })}` }}>查看同标签{label === '动态' ? '活动' : '动态'} →</Link>}
    </div>}
  </div>
}

export function TimelineTags({ tags, selectedTag, setSelectedTag, query }) {
  const values = normalizeTags(tags)
  if (!values.length) return null
  return <div className="timeline-tags" aria-label="内容标签">{values.map((tag) =>
    <button type="button" key={tag} aria-label={`查看标签：${tag}`} aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}><span aria-hidden="true">#</span> <SearchHighlight query={query}>{tag}</SearchHighlight></button>,
  )}</div>
}
