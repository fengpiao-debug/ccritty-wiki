// 分栏公共页脚：站点品牌、栏目导航、关于介绍、联系方式与备案信息。
import { Link } from 'react-router-dom'
import { ArrowUpRight, Mail } from 'lucide-react'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'

function Filing({ number, url }) {
  if (!number) return null
  return url ? <a href={url} target="_blank" rel="noopener noreferrer">{number}</a> : <span>{number}</span>
}

export function PublicFooter({ settings: savedSettings }) {
  const settings = { ...DEFAULT_SITE_SETTINGS, ...savedSettings }
  return <footer className="public-footer">
    <div className="public-footer-main">
      <div className="public-footer-brand">
        <Link to="/" className="public-footer-lockup"><span className="brand-mark" aria-hidden="true">印</span><strong>{settings.footerName || '音乐档案'}</strong></Link>
        {settings.footerDescription && <p>{settings.footerDescription}</p>}
        <small>ARTIST ARCHIVE</small>
      </div>
      <nav className="public-footer-column" aria-label="页脚栏目导航">
        <h2>探索档案</h2>
        <Link to="/music">音乐作品</Link>
        <Link to="/news">近期动态</Link>
        <Link to="/events">活动行程</Link>
        <Link to="/gallery">影像记录</Link>
      </nav>
      <section className="public-footer-column">
        <h2>{settings.aboutTitle || '关于本站'}</h2>
        {settings.footerAbout && <p>{settings.footerAbout}</p>}
        <Link to="/about" className="public-footer-more">了解更多 <ArrowUpRight size={14} /></Link>
      </section>
      <section className="public-footer-column">
        <h2>联系我们</h2>
        {settings.contactNote && <p>{settings.contactNote}</p>}
        {settings.contactEmail && <a className="public-footer-email" href={`mailto:${encodeURIComponent(settings.contactEmail)}`}><Mail size={15} />{settings.contactEmail}</a>}
      </section>
    </div>
    <div className="public-footer-bottom">
      {settings.copyright && <p>{settings.copyright}</p>}
      {(settings.icpNumber || settings.policeNumber) && <div className="public-footer-filings">
        <Filing number={settings.icpNumber} url={settings.icpUrl} />
        <Filing number={settings.policeNumber} url={settings.policeUrl} />
      </div>}
    </div>
  </footer>
}
