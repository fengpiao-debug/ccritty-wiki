// 文件作用：apps/web/src/features/public/GalleryPage.jsx，负责公开 Wiki 内容展示。
import { useState } from 'react'
import { X } from 'lucide-react'
import { useContent } from './useContent'
import { PageHeading } from './NewsPage'

export function GalleryPage() {
  const { content } = useContent()
  const [active, setActive] = useState(null)
  return (
    <div className="content-page">
      <PageHeading number="05" title="影卷" subtitle="Visual Chronicle" />
      <div className="gallery-grid">
        {content.photos.map((photo, index) => (
          <button className={`gallery-tile gallery-tile-${index % 3}`} key={photo.id} onClick={() => setActive(photo)}>
            {photo.url ? <img src={photo.url} alt={photo.title || `照片 ${index + 1}`} loading="lazy" /> : <span>{photo.title || '待上传照片'}</span>}
            <small>{photo.caption || 'Visual Archive'}</small>
          </button>
        ))}
        {!content.photos.length && <p className="empty-copy">照片档案尚未建立。</p>}
      </div>
      {active && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setActive(null)}>
          <button className="lightbox-close" onClick={() => setActive(null)} aria-label="关闭预览"><X /></button>
          <img src={active.url} alt={active.title || '照片预览'} />
        </div>
      )}
    </div>
  )
}
