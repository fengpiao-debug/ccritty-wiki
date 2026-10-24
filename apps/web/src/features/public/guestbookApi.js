import { apiRequest, API_BASE } from '../../lib/api'

export function guestKey() {
  let key = localStorage.getItem('artist-wiki-guest-key')
  if (!/^[a-f0-9]{64}$/.test(key || '')) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('artist-wiki-guest-key', key)
  }
  return key
}
export const guestbookRequest = (path = '', options = {}) => apiRequest(`/guestbook${path}`, {
  ...options, headers: { 'X-Guest-Key': guestKey(), ...options.headers },
})

export async function getGuestbookImage(id, admin, signal) {
  const headers = admin ? { Authorization: `Bearer ${localStorage.getItem('artist-wiki-token') || ''}` } : { 'X-Guest-Key': guestKey() }
  const response = await fetch(`${API_BASE}/${admin ? 'admin/' : ''}guestbook/assets/${encodeURIComponent(id)}`, { headers, signal, cache: 'no-store' })
  if (!response.ok) throw new Error('图片暂时无法加载')
  return response.blob()
}
