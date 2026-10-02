// 文件作用：按账号职责分发后台路由；管理员进入账号管理，编辑者进入授权内容栏目。
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { adminModules } from './adminModules'
import { UserManagementPage } from './UserManagementPage'
import { ContentManagementPage } from './ContentManagementPage'
import { AuditLogPage } from './AuditLogPage'
import { ImageAssetManagementPage } from './ImageAssetManagementPage'
import { SiteSettingsPage } from './SiteSettingsPage'

export function AdminDashboard() {
  const auth = useAuth()
  const modules = adminModules.filter((item) => auth.can(`${item.scope}.read`))
  const home = auth.can('user.manage') ? 'users' : (auth.can('image.read') || auth.can('image.song.read') || auth.can('image.video.read')) ? 'images' : modules.length ? `content/${modules[0].type}` : 'unassigned'
  return <Routes>
    <Route index element={<Navigate to={home} replace />} />
    <Route path="users" element={auth.can('user.manage') ? <UserManagementPage /> : <Navigate to="/admin" replace />} />
    <Route path="logs" element={auth.can('user.manage') ? <AuditLogPage /> : <Navigate to="/admin" replace />} />
    <Route path="settings" element={auth.can('user.manage') ? <SiteSettingsPage /> : <Navigate to="/admin" replace />} />
    <Route path="images" element={(auth.can('image.read') || auth.can('image.song.read') || auth.can('image.video.read')) ? <ImageAssetManagementPage /> : <Navigate to="/admin" replace />} />
    {modules.map((item) => <Route key={item.type} path={`content/${item.type}`} element={<ContentManagementPage key={item.type} module={item} />} />)}
    <Route path="unassigned" element={<div className="cms-empty"><h2>暂无内容权限</h2><p>请联系管理员分配负责的栏目。</p></div>} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
}
