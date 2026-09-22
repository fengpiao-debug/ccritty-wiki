// 文件作用：apps/web/src/features/auth/AuthContext.jsx，负责前端登录会话和权限状态。
import { createContext, useContext, useEffect, useState } from 'react'
import { contentApi } from '../../lib/api'
import { can, permissionsForUser } from '@artist-wiki/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const expire = () => { if (active) logout() }
    window.addEventListener('wiki:session-expired', expire)
    if (localStorage.getItem('artist-wiki-token')) {
      contentApi.me().then(({ user }) => {
        if (active) setSession(user)
      }).catch(() => { if (active) logout() }).finally(() => { if (active) setLoading(false) })
    } else setLoading(false)
    return () => { active = false; window.removeEventListener('wiki:session-expired', expire) }
  }, [])
  function login(payload) {
    localStorage.setItem('artist-wiki-token', payload.token)
    localStorage.setItem('artist-wiki-session', JSON.stringify(payload.user))
    setSession(payload.user)
  }
  function logout() {
    localStorage.removeItem('artist-wiki-token')
    localStorage.removeItem('artist-wiki-session')
    setSession(null)
  }
  return <AuthContext.Provider value={{ session, loading, login, logout, can: (permission) => can(permissionsForUser(session), permission) }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
