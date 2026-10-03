// 文件作用：公开 Wiki 的统一页面布局，负责主导航、内容出口和全局播放器。
import { NavLink, Outlet } from 'react-router-dom'
import { Image, Library, CalendarDays, Newspaper, PlaySquare, UserRound } from 'lucide-react'
import { useContent } from '../features/public/useContent'
import { useSiteSettings } from '../features/public/useSiteSettings'
import { PublicFooter } from './PublicFooter'
import { BrandMark } from './BrandMark'

const navItems = [
  ['/', '主卷', UserRound],
  ['/news', '动态', Newspaper],
  ['/events', '活动', CalendarDays],
  ['/gallery', '影卷', Image],
  ['/music', '作品', Library],
  ['/videos', '视频', PlaySquare],
]

export function PublicLayout() {
  const { content } = useContent()
  const siteSettings = useSiteSettings()
  const { settings } = siteSettings
  const artistName = content.profile?.artistName || '歌手 Wiki'

  return (
    <div className="public-app">
      <header className="public-header">
        <NavLink to="/" className="brand-lockup">
          <BrandMark src={settings.headerLogoUrl} text={settings.headerMarkText} />
          <span>
            <strong>{settings.headerName || artistName}</strong>
            {settings.headerSubtitle && <small>{settings.headerSubtitle}</small>}
          </span>
        </NavLink>
        <nav className="public-nav" aria-label="主导航">
          {navItems.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="public-main">
        <Outlet context={siteSettings} />
      </main>
      <PublicFooter settings={siteSettings.settings} />
    </div>
  )
}
