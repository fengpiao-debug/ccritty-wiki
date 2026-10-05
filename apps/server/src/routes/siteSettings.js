// 公共信息读取，以及仅管理员可操作的网站设置接口。
import { Router } from 'express'
import { isSiteImageUrl, validateSiteSettings } from '@artist-wiki/content-types'
import { requirePermission } from '../middleware/permissions.js'

export function createSiteSettingsRouter({ read, save, audit }) {
  const router = Router()
  // 首次加载和浏览器默认的 /favicon.ico 请求都读取已保存的设置。
  router.get('/favicon', (request, response) => {
    const icon = read().faviconUrl?.trim()
    let target = '/favicon-32.png'
    if (icon && isSiteImageUrl(icon)) {
      const address = new URL(icon, `${request.protocol}://${request.get('host')}`)
      const selfReference = address.host === request.get('host')
        && ['/favicon.ico', '/api/favicon'].includes(address.pathname.replace(/\/$/, ''))
      if (!selfReference) target = icon
    }
    response.set('Cache-Control', 'no-store')
    response.redirect(302, target)
  })
  const sendSettings = (_request, response) => {
    response.set('Cache-Control', 'no-store')
    response.json({ settings: read() })
  }
  router.get('/site-settings', sendSettings)
  router.get('/admin/site-settings', requirePermission('user.manage'), sendSettings)
  router.put('/admin/site-settings', requirePermission('user.manage'), async (request, response) => {
    const invalid = validateSiteSettings(request.body)
    if (invalid) return response.status(400).json({ message: invalid })
    const patch = Object.fromEntries(Object.entries(request.body).map(([key, value]) => [key, key === 'aboutMarkdown' ? value : value.trim()]))
    const settings = await save({ ...read(), ...patch })
    await audit({ actor: request.actor.username, action: 'settings.save', target: 'settings' })
    response.json({ settings })
  })
  return router
}
