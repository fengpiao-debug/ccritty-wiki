// 文件作用：apps/web/src/features/public/HomePage.jsx，负责公开 Wiki 内容展示。
import { ArrowDown, ArrowUpRight, CalendarDays, Music2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useContent } from './useContent'
import { Markdown } from './Markdown'
import { formatDate } from '../../utils/content'
import { normalizePhotoAlbum } from '@artist-wiki/content-types'

export function HomePage() {
  const { content, loading } = useContent()
  const profile = content.profile
  const latestNews = content.news.slice(0, 3)

  return (
    <div className="paper-page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Artist Archive / 2026</p>
          <h1>{profile.artistName}</h1>
          <p className="hero-subtitle">{profile.subtitle}</p>
          <p className="hero-intro">把歌声、舞台、影像和时间，收进一卷可阅读的档案。</p>

        </div>
        <div className="hero-portrait" style={profile.heroImage ? { backgroundImage: `url(${profile.heroImage})` } : undefined}>
          {!profile.heroImage && <span className="hero-seal">歌者<br />如月</span>}
          <span className="hero-vertical">声 · 色 · 事</span>
        </div>

      </section>

      <section className="content-band biography-band">
        <div className="section-label"><strong>{profile.biographyTitle?.trim() || '锦书'}</strong><small>Biography</small></div>
        <div className="wide-copy">
          <p className="section-lead">一位歌手的声音，既是作品，也是时间留下的纹理。</p>
          <Markdown>{profile.markdown}</Markdown>
        </div>
      </section>

      <section className="content-band summary-grid">
        <Link to="/music" className="summary-stat"><Music2 size={20} /><strong>{content.songs.length}</strong><span>作品收录</span></Link>
        <Link to="/events" className="summary-stat"><CalendarDays size={20} /><strong>{content.events.length}</strong><span>未来活动</span></Link>
        <Link to="/gallery" className="summary-stat"><span className="seal-small">影</span><strong>{content.photos.reduce((count, album) => count + normalizePhotoAlbum(album).images.length, 0)}</strong><span>影像记录</span></Link>
      </section>

      <section className="content-band latest-band">
        <div className="section-label"><strong>近讯</strong><small>Latest Notes</small></div>
        <div className="latest-list">
          {loading && <p className="empty-copy">正在展开档案...</p>}
          {latestNews.map((item) => (
            <Link key={item.id} to="/news" className="latest-item">
              <time>{formatDate(item.publishedAt)}</time>
              <strong>{item.title}</strong>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
