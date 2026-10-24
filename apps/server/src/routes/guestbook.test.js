import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import sharp from 'sharp'
import { createGuestbookRouter } from './guestbook.js'
import { renderGuestbookMarkdown } from '@artist-wiki/markdown'

const owner = 'a'.repeat(64)
const stranger = 'b'.repeat(64)
async function setup(t) {
  const messages = []
  const assets = new Map()
  const app = express()
  app.use(express.json())
  app.use('/api', createGuestbookRouter({
    authenticateAdmin: [(req, res, next) => {
      if (!req.get('X-Test-Role')) return res.status(401).end()
      req.actor = { role: req.get('X-Test-Role'), username: 'reviewer' }; next()
    }],
    store: {
      async list({ owner, status = 'approved', page = 1, featuredOnly = false }) {
        const selected = messages.filter(item => (owner ? item.owner === owner : item.status === status) && (!featuredOnly || (item.featured && item.status === 'approved')))
        return { items: selected.slice((page - 1) * 10, page * 10).map(({ owner, ...item }) => item), total: selected.length, page }
      },
      async create(message, uploads) {
        messages.unshift({ ...message, assets: uploads.map(({ id, kind }) => ({ id, kind })) })
        uploads.forEach(asset => assets.set(asset.id, { ...asset, messageId: message.id }))
      },
      async asset(id) {
        const asset = assets.get(id)
        if (!asset) return undefined
        const message = messages.find(item => item.id === asset.messageId)
        return { ...asset, owner: message.owner, status: message.status }
      },
      async review(id, status, actor) {
        const message = messages.find(item => item.id === id)
        if (!message) return false
        message.status = status; message.reviewedBy = actor
        if (status !== 'approved') message.featured = false
        return true
      },
      async setFeatured(id, featured) {
        const message = messages.find(item => item.id === id && item.status === 'approved')
        if (!message) return false
        message.featured = featured; return true
      },
      async remove(id) {
        const index = messages.findIndex(item => item.id === id)
        if (index < 0) return false
        messages.splice(index, 1)
        for (const [key, asset] of assets) if (asset.messageId === id) assets.delete(key)
        return true
      },
      async interact(id, owner, action, value) {
        const item = messages.find(row => row.id === id && row.status === 'approved')
        if (!item) return null
        if (action === 'like') return { liked: value, likeCount: value ? 1 : 0 }
        return { reported: true }
      },
      async resolveReports(id) { return messages.some(item => item.id === id) },
    },
  }))
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const request = (path, { key, role, body, method = 'GET' } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers: { ...(key ? { 'X-Guest-Key': key } : {}), ...(role ? { 'X-Test-Role': role } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  })
  return { request, messages }
}

test('pending messages and attachments stay private until approval; withdrawal removes public access', async t => {
  const { request } = await setup(t)
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ff0000' } }).png().toBuffer()
  const body = new FormData()
  body.append('markdown', '**你好** 😊')
  body.append('kinds', '["emoji"]'); body.append('files', new Blob([png], { type: 'image/png' }), '表情.png')
  const submitted = await request('/guestbook', { key: owner, body, method: 'POST' })
  assert.equal(submitted.status, 201)
  const { item } = await submitted.json()
  assert.equal(item.status, 'pending'); assert.equal(item.owner, undefined); assert.equal(item.nickname, undefined)
  const assetPath = `/guestbook/assets/${item.assets[0].id}`
  assert.equal((await request('/guestbook')).headers.get('cache-control'), 'no-store')
  assert.equal((await (await request('/guestbook')).json()).items.length, 0)
  assert.equal((await (await request('/guestbook/mine', { key: stranger })).json()).items.length, 0)
  assert.equal((await (await request('/guestbook/mine', { key: owner })).json()).items[0].id, item.id)
  assert.equal((await request(assetPath)).status, 404)
  assert.equal((await request(assetPath, { key: stranger })).status, 404)
  const ownImage = await request(assetPath, { key: owner })
  assert.equal(ownImage.status, 200); assert.equal(ownImage.headers.get('content-type'), 'image/webp')
  assert.equal((await request(`/admin${assetPath}`, { role: 'admin' })).status, 200)
  for (const role of [undefined, 'editor']) {
    assert.ok([401, 403].includes((await request('/admin/guestbook', { role })).status))
    assert.ok([401, 403].includes((await request(`/admin/guestbook/${item.id}`, { role, method: 'PATCH', body: { status: 'approved' } })).status))
    assert.ok([401, 403].includes((await request(`/admin${assetPath}`, { role })).status))
  }
  assert.equal((await request(`/admin/guestbook/${item.id}`, { role: 'admin', method: 'PATCH', body: { status: 'approved' } })).status, 200)
  assert.equal((await (await request('/guestbook')).json()).items[0].id, item.id)
  assert.equal((await request(assetPath)).status, 200)
  assert.equal((await request(`/admin/guestbook/${item.id}`, { role: 'admin', method: 'PATCH', body: { status: 'rejected' } })).status, 200)
  assert.equal((await (await request('/guestbook')).json()).total, 0)
  assert.equal((await request(assetPath)).status, 404)
  assert.equal((await request(assetPath, { key: owner })).status, 200)
})

test('server controls status and owner and rejects invalid submissions and disguised uploads', async t => {
  const { request, messages } = await setup(t)
  const body = { nickname: '访客', markdown: '留言', status: 'approved', featured: true, owner: stranger }
  assert.equal((await request('/guestbook', { body, method: 'POST' })).status, 400)
  assert.equal((await request('/guestbook', { key: owner, body, method: 'POST' })).status, 201)
  assert.equal(messages[0].status, 'pending'); assert.notEqual(messages[0].owner, stranger); assert.equal(messages[0].nickname, undefined)
  assert.equal(messages[0].featured, false)
  for (const invalid of [{ ...body, markdown: '' }, { ...body, markdown: 'x'.repeat(5001) }, { ...body, kinds: '{}' }]) {
    assert.equal((await request('/guestbook', { key: owner, body: invalid, method: 'POST' })).status, 400)
  }
  const file = new FormData()
  file.append('nickname', '访客'); file.append('markdown', '测试'); file.append('kinds', '["image"]')
  file.append('files', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'fake.png')
  assert.equal((await request('/guestbook', { key: owner, body: file, method: 'POST' })).status, 400)
  assert.equal((await request('/admin/guestbook/missing', { role: 'admin', body: { status: 'approved' }, method: 'PATCH' })).status, 404)
  assert.equal((await request('/admin/guestbook/missing', { role: 'admin', body: { status: 'pending' }, method: 'PATCH' })).status, 400)
  assert.equal(messages.length, 1)
})

test('submission rate limiting applies across visitor keys', async t => {
  const { request } = await setup(t)
  for (let i = 0; i < 12; i++) assert.equal((await request('/guestbook', { key: owner, method: 'POST', body: { nickname: '访客', markdown: '你好' } })).status, 201)
  assert.equal((await request('/guestbook', { key: stranger, method: 'POST', body: { nickname: '访客', markdown: '你好' } })).status, 429)
})

test('Markdown supports formatting while blocking raw HTML, script URLs and unreviewed remote images', () => {
  const html = renderGuestbookMarkdown('**你好** 😊\n\n<script>alert(1)</script>\n\n[点击](javascript:alert(1))\n\n![替换图片](https://example.com/tracker.png)')
  assert.match(html, /<strong>你好<\/strong>/)
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('href="javascript:')); assert.ok(!html.includes('<img'))
})

test('only admins can feature approved messages or delete them; removing content also removes its attachments', async t => {
  const { request } = await setup(t)
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#fff' } }).png().toBuffer()
  const body = new FormData()
  body.append('markdown', '精选测试'); body.append('kinds', '["image"]')
  body.append('files', new Blob([png], { type: 'image/png' }), 'test.png')
  const { item } = await (await request('/guestbook', { key: owner, body, method: 'POST' })).json()
  const route = `/admin/guestbook/${item.id}`
  for (const role of [undefined, 'editor']) {
    assert.ok([401, 403].includes((await request(`${route}/featured`, { role, key: owner, method: 'PATCH', body: { featured: true } })).status))
    assert.ok([401, 403].includes((await request(route, { role, key: owner, method: 'DELETE' })).status))
  }
  assert.equal((await request(`${route}/featured`, { role: 'admin', method: 'PATCH', body: { featured: true } })).status, 409)
  await request(route, { role: 'admin', method: 'PATCH', body: { status: 'approved' } })
  assert.equal((await request(`${route}/featured`, { role: 'admin', method: 'PATCH', body: { featured: 'true' } })).status, 400)
  assert.equal((await request(`${route}/featured`, { role: 'admin', method: 'PATCH', body: { featured: true } })).status, 200)
  assert.equal((await (await request('/guestbook?featured=1')).json()).items[0].featured, true)
  assert.equal((await (await request('/admin/guestbook?status=featured', { role: 'admin' })).json()).total, 1)
  await request(route, { role: 'admin', method: 'PATCH', body: { status: 'rejected' } })
  assert.equal((await (await request('/guestbook?featured=1')).json()).total, 0)
  const mine = await (await request('/guestbook/mine', { key: owner })).json()
  assert.equal(mine.items[0].featured, false)
  assert.equal((await request(route, { role: 'admin', method: 'DELETE' })).status, 200)
  assert.equal((await (await request('/guestbook/mine', { key: owner })).json()).total, 0)
  assert.equal((await request(`/guestbook/assets/${item.assets[0].id}`, { key: owner })).status, 404)
  assert.equal((await request(`/admin/guestbook/assets/${item.assets[0].id}`, { role: 'admin' })).status, 404)
  assert.equal((await request(route, { role: 'admin', method: 'DELETE' })).status, 404)
})

test('active SVG, HTML renamed as images, oversized images, and too many attachments are rejected', async t => {
  const { request } = await setup(t)
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#fff' } }).png().toBuffer()
  for (const [name, type, data, count] of [
    ['attack.svg', 'image/svg+xml', '<svg onload="alert(1)"></svg>', 1],
    ['attack.png', 'image/png', '<img src=x onerror="alert(1)">', 1],
    ['large.png', 'image/png', Buffer.alloc(2 * 1024 * 1024 + 1), 1],
    ['test.png', 'image/png', png, 5],
  ]) {
    const body = new FormData(); body.append('markdown', '安全测试'); body.append('kinds', JSON.stringify(Array(count).fill('image')))
    for (let i = 0; i < count; i++) body.append('files', new Blob([data], { type }), name)
    assert.equal((await request('/guestbook', { key: owner, method: 'POST', body })).status, 400)
  }
  assert.equal((await (await request('/guestbook/mine', { key: owner })).json()).total, 0)
})

test('anonymous interactions validate inputs, hide private messages, and protect report moderation', async t => {
  const { request } = await setup(t)
  const { item } = await (await request('/guestbook', { key: owner, method: 'POST', body: { markdown: '匿名互动测试' } })).json()
  const path = `/guestbook/${item.id}`
  assert.equal((await request(`${path}/like`, { method: 'PUT', body: { liked: true } })).status, 400)
  assert.equal((await request(`${path}/like`, { key: owner, method: 'PUT', body: { liked: 'yes' } })).status, 400)
  assert.equal((await request(`${path}/report`, { key: owner, method: 'POST', body: { reason: '<script>alert(1)</script>' } })).status, 400)
  assert.equal((await request(`${path}/like`, { key: owner, method: 'PUT', body: { liked: true } })).status, 404)
  assert.equal((await request(`${path}/report`, { key: stranger, method: 'POST', body: { reason: 'spam' } })).status, 404)
  for (const role of [undefined, 'editor']) {
    assert.ok([401, 403].includes((await request(`/admin${path}/reports`, { role, method: 'PATCH', body: { action: 'withdraw' } })).status))
  }
  await request(`/admin${path}`, { role: 'admin', method: 'PATCH', body: { status: 'approved' } })
  assert.equal((await request(`${path}/like`, { key: owner, method: 'PUT', body: { liked: true } })).status, 200)
  assert.equal((await request(`${path}/report`, { key: stranger, method: 'POST', body: { reason: 'spam' } })).status, 200)
  assert.equal((await request(`/admin${path}/reports`, { role: 'admin', method: 'PATCH', body: { action: 'delete' } })).status, 400)
  assert.equal((await request(`/admin${path}/reports`, { role: 'admin', method: 'PATCH', body: { action: 'dismiss' } })).status, 200)
})

test('interaction rate limiting also applies when anonymous keys change', async t => {
  const { request } = await setup(t)
  for (let i = 0; i < 120; i++) assert.equal((await request('/guestbook/missing/like', { key: owner, method: 'PUT', body: { liked: true } })).status, 404)
  assert.equal((await request('/guestbook/missing/report', { key: stranger, method: 'POST', body: { reason: 'spam' } })).status, 429)
})
