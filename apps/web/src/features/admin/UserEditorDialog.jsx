// 文件作用：创建编辑者或修改现有账号权限，提交前做基础校验，后端负责最终授权校验。
import { useState } from 'react'
import { Save } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { PermissionMatrix } from './PermissionMatrix'

export function UserEditorDialog({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ username: user?.username || '', displayName: user?.displayName || '', password: '', permissions: user?.permissions || [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const payload = { ...form, username: form.username.trim(), displayName: form.displayName.trim() }
      if (user) await contentApi.updateUser(user.id, payload)
      else await contentApi.createUser(payload)
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <AdminDialog title={user ? '编辑账号与权限' : '新增编辑者'} onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className="cms-dialog-body">
        <div className="cms-form-grid">
          <label>登录账号<input required pattern="[A-Za-z0-9_\-]{3,80}" maxLength={80} disabled={!!user || busy} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>显示名称<input required maxLength={120} disabled={busy} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
          <label className="full">{user ? '重置密码（留空不修改）' : '初始密码'}<input required={!user} type="password" minLength={8} maxLength={200} autoComplete="new-password" disabled={busy} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        </div>
        <fieldset disabled={busy}><PermissionMatrix value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} /></fieldset>
        {error && <p className="cms-alert error" role="alert">{error}</p>}
      </div>
      <footer className="cms-dialog-footer"><button type="button" className="cms-button" onClick={onClose} disabled={busy}>取消</button><button className="cms-button primary" disabled={busy}><Save size={16} />{busy ? '保存中…' : '保存账号'}</button></footer>
    </form>
  </AdminDialog>
}
