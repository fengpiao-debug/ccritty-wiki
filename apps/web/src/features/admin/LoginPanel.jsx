// 文件作用：apps/web/src/features/admin/LoginPanel.jsx，负责后台管理功能。
import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'

export function LoginPanel() {
  const auth = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try { auth.login(await contentApi.login(form)) } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <LockKeyhole size={20} />
        <p>ARTIST WIKI</p>
        <h1>管理控制台</h1>
        <label>账号<input required autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>密码<input required autoComplete="current-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error-copy">{error}</p>}
        <button className="cms-button primary" disabled={busy}>{busy ? '登录中...' : '登录后台'}</button>
      </form>
    </div>
  )
}
