// 分栏公共页脚：站点品牌、栏目导航、关于介绍、联系方式与备案信息。
import { useLayoutEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, Mail } from 'lucide-react'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { BrandMark } from './BrandMark'

function FooterLink(props) {
  const { key } = useLocation()
  const clicked = useRef(false)
  useLayoutEffect(() => {
    if (!clicked.current) return
    clicked.current = false
    // 等目标页面渲染后回顶；重复点击当前页入口同样生效。
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [key])
  return <Link {...props} onClick={(event) => {
    // 在新标签页打开时，保留当前页面的位置。
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) clicked.current = true
  }} />
}

function Filing({ number, url }) {
  if (!number) return null
  return url ? <a href={url} target="_blank" rel="noopener noreferrer">{number}</a> : <span>{number}</span>
}

export function PublicFooter({ settings: savedSettings }) {
  const settings = { ...DEFAULT_SITE_SETTINGS, ...savedSettings }
  return <footer className="public-footer">
    <div className="public-footer-main">
      <div className="public-footer-brand">
        <FooterLink to="/" className="public-footer-lockup"><BrandMark src={settings.footerLogoUrl} text={settings.footerMarkText} /><strong>{settings.footerName || '音乐档案'}</strong></FooterLink>
        {settings.footerDescription && <p>{settings.footerDescription}</p>}
        {settings.footerTagline && <small>{settings.footerTagline}</small>}
      </div>
      <nav className="public-footer-column" aria-label="页脚栏目导航">
        <h2>探索档案</h2>
        <FooterLink to="/music">音乐作品</FooterLink>
        <FooterLink to="/news">近期动态</FooterLink>
        <FooterLink to="/events">活动行程</FooterLink>
        <FooterLink to="/gallery">影像记录</FooterLink>
        <FooterLink to="/videos">视频作品</FooterLink>
      </nav>
      <section className="public-footer-column">
        <h2>{settings.aboutTitle || '关于本站'}</h2>
        {settings.footerAbout && <p>{settings.footerAbout}</p>}
        <FooterLink to="/about" className="public-footer-more">了解更多 <ArrowUpRight size={14} /></FooterLink>
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
