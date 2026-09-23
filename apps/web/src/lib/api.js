// 文件作用：apps/web/src/lib/api.js，负责项目公共配置或辅助逻辑。
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = localStorage.getItem('artist-wiki-token')
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('wiki:session-expired'))
    const error = new Error(payload.message || '请求失败')
    error.status = response.status
    throw error
  }
  return payload
}

export const contentApi = {
  getPublic: () => apiRequest('/content'),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiRequest('/auth/me'),
  getAdminContent: () => apiRequest('/admin/content'),
  saveContent: (type, id, body) =>
    apiRequest(`/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteContent: (type, id) =>
    apiRequest(`/admin/content/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getVersions: (type, id) => apiRequest(`/admin/content/${type}/${encodeURIComponent(id)}/versions`),
  getVersion: (type, id, versionId) => apiRequest(`/admin/content/${type}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`),
  restoreVersion: (type, id, versionId) =>
    apiRequest(`/admin/content/${type}/${encodeURIComponent(id)}/restore/${versionId}`, { method: 'POST' }),
  lock: (type, id) =>
    apiRequest(`/admin/locks/${type}/${encodeURIComponent(id)}`, { method: 'POST' }),
  unlock: (type, id) =>
    apiRequest(`/admin/locks/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  users: () => apiRequest('/admin/users'),
  auditLogs: () => apiRequest('/admin/audit-logs'),
  createUser: (body) => apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) =>
    apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id) => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
}
