// 文件作用：以紧凑缩略图网格展示公开视频，点击封面后才加载 B 站播放器。
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Search, X } from 'lucide-react'
import { VIDEO_CATEGORIES, matchesVideo, videoCategoryLabel } from '@artist-wiki/content-types'
import { useContent } from './useContent'
import { getVideoEmbedUrl } from '../../utils/content'
import { PageHeading } from './NewsPage'
import { resolveBilibiliJsonp } from '../../lib/bilibiliJsonp'
import { Markdown } from './Markdown'
import { SearchHighlight } from '../../components/SearchHighlight'

function VideoPlayer({ video, onClose }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="video-player-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <header className="video-player-header">
      <h2 id={titleId}>{video.title}</h2>
      <button type="button" className="video-player-close" aria-label="关闭视频" title="关闭视频" onClick={onClose}><X size={22} /></button>
    </header>
    {video.playableUrl && <div className="video-player-frame">
      <iframe title={video.title} src={video.playableUrl} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>}
    <section className="video-detail-copy">
      <div className="video-detail-meta"><span>{videoCategoryLabel(video.category)}</span>{video.authorName && <span>作者：{video.authorName}</span>}{video.publishedAt && <time dateTime={video.publishedAt}>{video.publishedAt.replace('T', ' ')}</time>}{video.location && <span>{video.location}</span>}</div>
      {video.description && <p className="video-description">{video.description}</p>}
      {video.keywords && <p className="video-keywords">关键词：{video.keywords}</p>}
      {video.markdown && <Markdown>{video.markdown}</Markdown>}
      {!video.playableUrl && <p>视频播放链接待补充。</p>}
    </section>
  </dialog>, document.body)
}

function VideoCard({ video, onPlay, query }) {
  const [cover, setCover] = useState(video.cover || '')
  const embedUrl = getVideoEmbedUrl(video.embedUrl || video.bvid)
  const playableUrl = embedUrl ? embedUrl.replace(/([?&])autoplay=0(?:&|$)/, '$1autoplay=1&') : ''

  useEffect(() => {
    setCover(video.cover || '')
    if (video.cover || !embedUrl) return undefined
    let active = true
    resolveBilibiliJsonp(video.embedUrl || video.bvid).then((details) => {
      if (active && details.cover) setCover(details.cover)
    }).catch(() => {})
    return () => { active = false }
  }, [video.cover, video.embedUrl, video.bvid, embedUrl])

  return <article className="video-card">
    <div className="video-frame">
      <button className="video-cover" type="button" disabled={!playableUrl} aria-label={`播放 ${video.title}`} onClick={() => onPlay({ ...video, playableUrl })}>
        {cover ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="video-cover-placeholder">BILIBILI</span>}
        {playableUrl && <span className="video-play"><Play size={22} fill="currentColor" /></span>}
      </button>
    </div>
    <h2 className="video-title"><SearchHighlight query={query}>{video.title}</SearchHighlight></h2>
    <p className="video-card-meta"><SearchHighlight query={query}>{videoCategoryLabel(video.category)}</SearchHighlight>{video.authorName && <> · <SearchHighlight query={query}>{video.authorName}</SearchHighlight></>}</p>
    {(video.publishedAt || video.location) && <p className="video-card-meta"><SearchHighlight query={query}>{[video.publishedAt?.slice(0, 10), video.location].filter(Boolean).join(' · ')}</SearchHighlight></p>}
    <button type="button" className="text-link video-details-link" onClick={() => onPlay({ ...video, playableUrl })}>查看详情</button>
  </article>
}

export function VideoPage() {
  const { content } = useContent()
  const [activeVideo, setActiveVideo] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const visible = content.videos.filter((video) => (category === 'all' || (video.category || 'other') === category) && matchesVideo(video, query))
  return (
    <div className="content-page">
      <PageHeading title="视频" subtitle="Moving Images" />
      <div className="album-tools"><div className="album-filters" aria-label="视频分类">{[{ value: 'all', label: '全部' }, ...VIDEO_CATEGORIES].map((item) => <button type="button" key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
        <label className="album-search"><Search size={18} /><input aria-label="搜索视频" placeholder="搜索标题、作者、时间、地点、关键词…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" className="album-icon" aria-label="清空视频搜索" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      </div>
      <p className="album-results" role="status">共 {visible.length} 个视频{(query || category !== 'all') && <button type="button" onClick={() => { setQuery(''); setCategory('all') }}>重置筛选</button>}</p>
      <div className="video-grid">
        {visible.map((video) => <VideoCard video={video} key={video.id} query={query} onPlay={setActiveVideo} />)}
        {!visible.length && <p className="empty-copy">{content.videos.length ? '没有找到匹配的视频，试试其他关键词。' : '视频档案尚未建立。'}</p>}
      </div>
      {activeVideo && <VideoPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  )
}
