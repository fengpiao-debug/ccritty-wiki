// 接口回归使用内存数据，不修改真实数据库。
import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { createSiteSettingsRouter } from './siteSettings.js'

async function setup(t) {
  let saved = { ...DEFAULT_SITE_SETTINGS }
  const entries = []
  const app = express()
  app.use(express.json({ strict: false }))
  app.use((req, _res, next) => {
    if (req.headers['x-test-role']) req.actor = { username: 'test', role: req.headers['x-test-role'], permissions: ['user.manage', 'text.write'] }
    next()
  })
  app.use('/api', createSiteSettingsRouter({
    read: () => ({ ...saved }),
    save: async (value) => { saved = value; return value },
    audit: async (entry) => entries.push(entry),
  }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())))
  const request = (path, role, body) => fetch('http://127.0.0.1:' + server.address().port + '/api' + path, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { request, entries }
}

test('admin saves footer/about settings, public reads them, blank values clear existing fields', async (t) => {
  const { request, entries } = await setup(t)
  const update = { copyright: '© 测试站点', icpNumber: ' 测试备案号 ', aboutTitle: '关于我们', aboutMarkdown: '## 介绍\n\n公开说明', footerAbout: '音乐爱好者的小站', contactEmail: 'archive@example.com' }
  const result = await request('/admin/site-settings', 'admin', update)
  assert.equal(result.status, 200)
  const { settings } = await result.json()
  assert.equal(settings.icpNumber, '测试备案号')
  assert.equal(settings.aboutMarkdown, update.aboutMarkdown)
  assert.equal(settings.footerAbout, update.footerAbout)
  assert.equal(settings.contactEmail, update.contactEmail)
  assert.equal(settings.icpUrl, DEFAULT_SITE_SETTINGS.icpUrl)
  const publicResult = await request('/site-settings')
  assert.equal(publicResult.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await publicResult.json(), { settings })
  assert.deepEqual(await (await request('/admin/site-settings', 'admin')).json(), { settings })
  await request('/admin/site-settings', 'admin', { icpNumber: '', aboutMarkdown: '' })
  const cleared = (await (await request('/site-settings')).json()).settings
  assert.equal(cleared.icpNumber, '')
  assert.equal(cleared.aboutMarkdown, '')
  assert.equal(cleared.copyright, update.copyright)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].action, 'settings.save')
})

test('anonymous users and editors cannot access admin settings, including forged stored grants', async (t) => {
  const { request, entries } = await setup(t)
  for (const role of [undefined, 'editor']) {
    assert.equal((await request('/admin/site-settings', role)).status, 403)
    assert.equal((await request('/admin/site-settings', role, { icpNumber: 'unauthorized' })).status, 403)
  }
  assert.equal((await (await request('/site-settings')).json()).settings.icpNumber, '')
  assert.equal(entries.length, 0)
})

test('branding settings round trip through public and admin APIs and can be cleared independently', async (t) => {
  const { request } = await setup(t)
  const branding = {
    siteTitle: ' 音乐收藏 ', faviconUrl: '/uploads/images/icon.png', headerName: '站点名字',
    headerSubtitle: 'My Archive', headerLogoUrl: 'https://example.com/header.png', headerMarkText: '影',
    footerLogoUrl: '/uploads/images/footer.png', footerMarkText: '音', footerTagline: '一起收藏音乐',
  }
  assert.equal((await request('/admin/site-settings', 'admin', branding)).status, 200)
  const settings = (await (await request('/site-settings')).json()).settings
  for (const [key, value] of Object.entries(branding)) assert.equal(settings[key], value.trim())
  assert.equal(settings.footerName, DEFAULT_SITE_SETTINGS.footerName)
  await request('/admin/site-settings', 'admin', { faviconUrl: '', headerSubtitle: '', footerLogoUrl: '', footerTagline: '' })
  const cleared = (await (await request('/site-settings')).json()).settings
  assert.equal(cleared.faviconUrl, '')
  assert.equal(cleared.headerSubtitle, '')
  assert.equal(cleared.footerTagline, '')
  assert.equal(cleared.headerLogoUrl, branding.headerLogoUrl)
})

test('branding rejects script, credential, malformed and oversized image URLs', async (t) => {
  const { request, entries } = await setup(t)
  for (const key of ['faviconUrl', 'headerLogoUrl', 'footerLogoUrl']) {
    for (const value of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/icon.png', '/\\evil.test/icon.png', 'https://user:pass@example.com/a.png', '/bad\npath.png', 'not-a-url', '/' + 'a'.repeat(2000)]) {
      assert.equal((await request('/admin/site-settings', 'admin', { [key]: value })).status, 400, `${key}: ${value}`)
    }
  }
  assert.equal((await request('/admin/site-settings', 'admin', { headerMarkText: '超过四个字符' })).status, 400)
  assert.deepEqual((await (await request('/site-settings')).json()).settings, DEFAULT_SITE_SETTINGS)
  assert.equal(entries.length, 0)
})

test('invalid URLs, oversized or non-text values and unknown keys do not change settings', async (t) => {
  const { request, entries } = await setup(t)
  for (const body of [null, [], { policeUrl: 'javascript:alert(1)' }, { icpUrl: 'not-a-url' }, { icpUrl: 'https://user:password@example.com' }, { aboutMarkdown: 'a'.repeat(20001) }, { contactEmail: 'not-an-email' }, { footerAbout: 42 }, { copyright: 42 }, { permissions: ['*'] }]) {
    assert.equal((await request('/admin/site-settings', 'admin', body)).status, 400)
  }
  assert.deepEqual((await (await request('/site-settings')).json()).settings, DEFAULT_SITE_SETTINGS)
  assert.equal(entries.length, 0)
})
