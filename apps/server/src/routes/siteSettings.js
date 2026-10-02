// 公共信息读取，以及仅管理员可操作的网站设置接口。
import { Router } from 'express'
import { validateSiteSettings } from '@artist-wiki/content-types'
import { requirePermission } from '../middleware/permissions.js'

export function createSiteSettingsRouter({ read, save, audit }) {
  const router = Router()
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
