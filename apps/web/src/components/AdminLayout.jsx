// 文件作用：apps/web/src/components/AdminLayout.jsx，负责可复用的 React UI 组件。
import { Link, NavLink } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPanel } from '../features/admin/LoginPanel'
import { adminModules } from '../features/admin/adminModules'

// Admin layout is intentionally separate from the public shell so content tools never inherit public navigation state.
export function AdminLayout({ children }) {
  const auth = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const admin = auth.can('user.manage')
  const navClass = ({ isActive }) => `cms-nav-item${isActive ? ' active' : ''}`
  if (auth.loading) return <div className="admin-app cms-loading" role="status">正在验证登录状态…</div>
  if (!auth.session) return <div className="admin-app"><LoginPanel /></div>
  return (
    <div className={`admin-app cms-shell${menuOpen ? ' menu-open' : ''}`}>
      {menuOpen && <button className="cms-backdrop" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />}
      <aside className="cms-sidebar">
        <Link className="cms-brand" to="/admin"><span><ShieldCheck size={23} /></span><div>ARTIST WIKI<small>管理控制台</small></div></Link>
        <div className="cms-nav-caption">{admin ? '系统管理' : '内容工作台'}</div>
        <nav aria-label="后台导航" onClick={() => setMenuOpen(false)}>
          {admin && <NavLink to="/admin/users" className={navClass}><Users size={18} />账号与权限</NavLink>}
          {!admin && adminModules.filter((item) => auth.can(`${item.scope}.read`)).map(({ type, label, icon: Icon }) =>
            <NavLink key={type} to={`/admin/content/${type}`} className={navClass}><Icon size={18} />{label}</NavLink>)}
        </nav>
        <div className="cms-sidebar-bottom"><span className="cms-status-dot" />{admin ? '系统管理员' : '内容编辑者'}<small>Artist Wiki CMS</small></div>
      </aside>
      <div className="cms-workspace">
        <header className="cms-topbar">
          <button className="cms-icon cms-menu-toggle" title="展开导航" aria-label="展开导航" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
          <span className="cms-breadcrumb">管理控制台 <span>/</span> {admin ? '系统管理' : '内容管理'}</span>
          <div className="cms-topbar-actions">
            <Link to="/" className="cms-front-link"><ExternalLink size={15} /><span>前台站点</span></Link>
            <span className="cms-divider" />
            <span className="cms-avatar">{auth.session.displayName?.slice(0, 1)}</span>
            <div className="cms-account"><strong>{auth.session.displayName}</strong><small>{admin ? '管理员' : '编辑者'}</small></div>
            <button className="cms-icon" title="退出登录" aria-label="退出登录" onClick={auth.logout}><LogOut size={18} /></button>
          </div>
        </header>
        <main className="cms-main">{children}</main>
        <footer className="cms-footer">Artist Wiki · 管理控制台</footer>
      </div>
    </div>
  )
}
