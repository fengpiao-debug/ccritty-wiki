import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Images, Search, X } from 'lucide-react'
import { PHOTO_CATEGORIES, normalizePhotoAlbum, matchesPhotoAlbum, photoCategoryLabel, photoAuthorLabel } from '@artist-wiki/content-types'
import { useContent } from './useContent'
import { PageHeading } from './NewsPage'
import { SearchHighlight } from '../../components/SearchHighlight'

const displayTime = (value) => value ? value.slice(0, 16).replace('T', ' ') : ''

function AlbumDetail({ album, onClose }) {
  const [index, setIndex] = useState(Math.max(0, album.images.findIndex((image) => image.id === album.coverImageId)))
  const dialogRef = useRef(null)
  const titleId = useId()
  const image = album.images[index]
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [])
  const move = (offset) => setIndex((current) => (current + offset + album.images.length) % album.images.length)
  return createPortal(<dialog ref={dialogRef} className="album-dialog" aria-labelledby={titleId}
    onCancel={(e) => { e.preventDefault(); onClose() }}
    onKeyDown={(e) => { if (album.images.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1) } }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="album-dialog-content">
      <header className="album-dialog-header"><div><span className="album-category">{photoCategoryLabel(album.category)} · {album.images.length} 张照片</span><h2 id={titleId}>{album.title || '未命名图集'}</h2></div><button type="button" className="album-icon" aria-label="关闭图集" onClick={onClose}><X size={22} /></button></header>
      <div className="album-detail-meta">{photoAuthorLabel(album) && <span>作者：{photoAuthorLabel(album)}</span>}{album.publishedAt && <time dateTime={album.publishedAt}>{displayTime(album.publishedAt)}</time>}{album.location && <span>{album.location}</span>}</div>
      {album.description && <p className="album-description">{album.description}</p>}
      {image ? <>
        <div className="album-viewer"><img key={image.id} src={image.url} alt={image.description || image.keywords || album.title + ' · 第 ' + (index + 1) + ' 张'} />
          {album.images.length > 1 && <><button type="button" className="album-photo-nav previous" aria-label="上一张图片" onClick={() => move(-1)}><ArrowLeft size={20} /></button><button type="button" className="album-photo-nav next" aria-label="下一张图片" onClick={() => move(1)}><ArrowRight size={20} /></button></>}
        </div>
        <div className="album-photo-info"><span role="status">{index + 1} / {album.images.length}</span><a href={image.url} target="_blank" rel="noreferrer">查看原图 ↗</a></div>
        {image.description && <p className="album-image-description">{image.description}</p>}
        {image.keywords && <p className="album-keywords"><span>关键词</span>{image.keywords}</p>}
        {album.images.length > 1 && <div className="album-thumbnails" aria-label="图集照片">{album.images.map((item, position) => <button type="button" key={item.id} aria-label={'查看第 ' + (position + 1) + ' 张图片'} aria-pressed={position === index} onClick={() => setIndex(position)}><img src={item.url} alt="" loading="lazy" /><span>{position + 1}</span></button>)}</div>}
      </> : <p className="empty-copy">图集暂无照片。</p>}
    </div>
  </dialog>, document.body)
}

export function GalleryPage() {
  const { content, loading } = useContent()
  const [active, setActive] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const albums = content.photos.map(normalizePhotoAlbum)
  const visible = albums.filter((album) => (category === 'all' || album.category === category) && matchesPhotoAlbum(album, query))
  return <div className="content-page album-page">
    <PageHeading title="影卷" subtitle="Visual Chronicle" />
    <div className="album-tools"><div className="album-filters" aria-label="图集分类">
      {[{ value: 'all', label: '全部' }, ...PHOTO_CATEGORIES].map((item) => <button type="button" key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}
    </div><label className="album-search"><Search size={18} /><input aria-label="搜索图集" placeholder="搜索标题、作者、时间、地点、关键词…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" className="album-icon" aria-label="清空搜索" onClick={() => setQuery('')}><X size={16} /></button>}</label></div>
    <p className="album-results" role="status">{loading && !albums.length ? '正在展开影卷…' : '共 ' + visible.length + ' 组图集'}{(query || category !== 'all') && <button type="button" onClick={() => { setQuery(''); setCategory('all') }}>重置筛选</button>}</p>
    <div className="album-grid">{visible.map((album) => <article className="album-card" key={album.id}>
      <button type="button" className="album-card-open" aria-label={'打开图集 ' + (album.title || '未命名图集')} onClick={() => setActive(album)}>
        <div className="album-cover">{album.url ? <img src={album.url} alt={album.title || '图集封面'} loading="lazy" /> : <span className="album-cover-empty">影卷</span>}<span className="album-count"><Images size={14} />{album.images.length} 张</span></div>
        <div className="album-card-copy"><span className="album-category"><SearchHighlight query={query}>{photoCategoryLabel(album.category)}</SearchHighlight></span><h2><SearchHighlight query={query}>{album.title || '未命名图集'}</SearchHighlight></h2>{album.description && <p><SearchHighlight query={query}>{album.description}</SearchHighlight></p>}<div className="album-card-meta">{album.publishedAt && <time dateTime={album.publishedAt}><SearchHighlight query={query}>{displayTime(album.publishedAt)}</SearchHighlight></time>}{album.location && <span><SearchHighlight query={query}>{album.location}</SearchHighlight></span>}</div>{photoAuthorLabel(album) && <small><SearchHighlight query={query}>{photoAuthorLabel(album)}</SearchHighlight></small>}</div>
      </button>
    </article>)}</div>
    {!loading && !visible.length && <div className="album-empty"><Images size={32} /><p>{albums.length ? '没有找到匹配的图集，试试其他关键词。' : '影卷尚未收录图集。'}</p></div>}
    {active && <AlbumDetail album={active} onClose={() => setActive(null)} />}
  </div>
}
