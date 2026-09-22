// 文件作用：apps/web/src/features/public/VideoPage.jsx，负责公开 Wiki 内容展示。
import { PlaySquare } from 'lucide-react'
import { useContent } from './useContent'
import { getVideoEmbedUrl } from '../../utils/content'
import { PageHeading } from './NewsPage'

export function VideoPage() {
  const { content } = useContent()
  return (
    <div className="content-page">
      <PageHeading number="07" title="视频" subtitle="Moving Images" />
      <div className="video-grid">
        {content.videos.map((video) => (
          <article className="video-card" key={video.id}>
            <div className="video-frame">
              {getVideoEmbedUrl(video.embedUrl || video.bvid) && <iframe title={video.title} src={getVideoEmbedUrl(video.embedUrl || video.bvid)} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
            </div>
            <div className="video-caption"><PlaySquare size={16} /><h2>{video.title}</h2><p>{video.description}</p></div>
          </article>
        ))}
        {!content.videos.length && <p className="empty-copy">视频档案尚未建立。</p>}
      </div>
    </div>
  )
}
