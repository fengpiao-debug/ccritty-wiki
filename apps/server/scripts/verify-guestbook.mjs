import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import mysql from 'mysql2/promise'
import sharp from 'sharp'
import { once } from 'node:events'

// 本脚本只创建、删除自己生成的独立数据库，不修改项目数据库。
const database = `guestbook_check_${crypto.randomBytes(8).toString('hex')}`
process.env.MYSQL_DATABASE = database
const { initStore, getState, closeStore, pool } = await import('../src/store.js')
const { initGuestbook, guestbookStore } = await import('../src/services/guestbookStore.js')
const { createGuestbookRouter } = await import('../src/routes/guestbook.js')
const { authRequired, issueToken } = await import('../src/auth.js')
const { hydrateUser } = await import('../src/middleware/permissions.js')
let server
try {
  await initStore(); await initGuestbook()
  await pool.query('ALTER TABLE guestbook_messages DROP COLUMN featured')
  await initGuestbook()
  // 重复初始化应保留已有表并正常运行。
  await initGuestbook()
  const app = express(); app.use(express.json())
  app.use('/api', createGuestbookRouter({ store: guestbookStore, authenticateAdmin: [authRequired, hydrateUser] }))
  app.use((err, _req, res, _next) => { console.error(err.code || err.message); res.status(500).json({ message: 'failed' }) })
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const key = crypto.randomBytes(32).toString('hex')
  const another = crypto.randomBytes(32).toString('hex')
  const token = issueToken(getState().users.find(user => user.role === 'admin'))
  const send = (route, options = {}) => fetch(base + route, options)
  const body = new FormData()
  body.append('markdown', '**匿名数据库测试** 🌸'); body.append('kinds', '["image"]')
  const png = await sharp({ create: { width: 12, height: 12, channels: 4, background: '#a82d2c' } }).png().toBuffer()
  body.append('files', new Blob([png], { type: 'image/png' }), 'sample.png')
  const submitted = await send('/guestbook', { method: 'POST', headers: { 'X-Guest-Key': key }, body })
  assert.equal(submitted.status, 201)
  const { item } = await submitted.json()
  assert.ok(!('nickname' in item))
  const mine = await (await send('/guestbook/mine', { headers: { 'X-Guest-Key': key } })).json()
  assert.equal(mine.items[0].markdown, '**匿名数据库测试** 🌸'); assert.ok(!('nickname' in mine.items[0]))
  assert.equal((await (await send('/guestbook/mine', { headers: { 'X-Guest-Key': another } })).json()).total, 0)
  assert.equal((await (await send('/guestbook')).json()).total, 0)
  const asset = `/guestbook/assets/${item.assets[0].id}`
  assert.equal((await send(asset)).status, 404)
  assert.equal((await send(asset, { headers: { 'X-Guest-Key': key } })).status, 200)
  assert.equal((await send('/admin/guestbook')).status, 401)
  const review = status => send(`/admin/guestbook/${item.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  const like = (liked, guest = key) => send(`/guestbook/${item.id}/like`, { method: 'PUT', headers: { 'X-Guest-Key': guest, 'Content-Type': 'application/json' }, body: JSON.stringify({ liked }) })
  const report = (guest = key, reason = 'spam') => send(`/guestbook/${item.id}/report`, { method: 'POST', headers: { 'X-Guest-Key': guest, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
  const resolve = action => send(`/admin/guestbook/${item.id}/reports`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
  assert.equal((await like(true)).status, 404)
  assert.equal((await report()).status, 404)
  const feature = featured => send(`/admin/guestbook/${item.id}/featured`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ featured }) })
  assert.equal((await feature(true)).status, 409)
  assert.equal((await review('approved')).status, 200)
  // 重复与并发点赞均幂等；不同匿名身份各计一次。
  const liked = await Promise.all([like(true), like(true), like(true, another)])
  for (const response of liked) assert.equal(response.status, 200)
  assert.equal((await (await like(true)).json()).likeCount, 2)
  assert.equal((await (await like(false)).json()).likeCount, 1)
  assert.equal((await (await like(false)).json()).likeCount, 1)
  const viewerList = await (await send('/guestbook?sort=hot', { headers: { 'X-Guest-Key': another } })).json()
  assert.equal(viewerList.items[0].liked, true)
  assert.equal((await (await send('/guestbook', { headers: { 'X-Guest-Key': key } })).json()).items[0].liked, false)
  const newer = { id: crypto.randomUUID(), owner: crypto.createHash('sha256').update(key).digest('hex'), markdown: '更新但没有点赞的留言', createdAt: new Date(Date.now() + 1000).toISOString() }
  await guestbookStore.create(newer, []); await guestbookStore.review(newer.id, 'approved', 'admin')
  assert.equal((await (await send('/guestbook?sort=hot')).json()).items[0].id, item.id)
  assert.equal((await (await send('/guestbook?sort=latest')).json()).items[0].id, newer.id)
  await guestbookStore.remove(newer.id)
  assert.equal((await report(key, '<script>')).status, 400)
  assert.equal((await report()).status, 200); assert.equal((await report()).status, 200)
  const adminHeaders = { Authorization: `Bearer ${token}` }
  let reports = await (await send('/admin/guestbook?status=reported', { headers: adminHeaders })).json()
  assert.equal(reports.total, 1); assert.equal(reports.items[0].reportCount, 1)
  assert.deepEqual(reports.items[0].reportReasons, [{ reason: 'spam', total: 1 }])
  const publicReports = await (await send('/guestbook', { headers: { 'X-Guest-Key': key } })).json()
  assert.equal(publicReports.items[0].reported, true)
  assert.ok(!('reportCount' in publicReports.items[0])); assert.ok(!('reportReasons' in publicReports.items[0]))
  assert.equal((await resolve('dismiss')).status, 200)
  assert.equal((await (await send('/admin/guestbook?status=reported', { headers: adminHeaders })).json()).total, 0)
  assert.equal((await (await send('/guestbook')).json()).total, 1)
  // 已处理的同一身份举报不重开，另一个身份的举报仍进入待处理队列。
  await report(); await report(another, 'abuse')
  reports = await (await send('/admin/guestbook?status=reported', { headers: adminHeaders })).json()
  assert.equal(reports.items[0].reportCount, 1)
  assert.equal((await feature(true)).status, 200)
  assert.equal((await (await send('/guestbook?featured=1')).json()).items[0].featured, true)
  assert.equal((await feature(false)).status, 200)
  assert.equal((await (await send('/guestbook?featured=1')).json()).total, 0)
  assert.equal((await feature(true)).status, 200)
  const publicData = await (await send('/guestbook')).json()
  assert.equal(publicData.total, 1); assert.ok(!('nickname' in publicData.items[0])); assert.ok(!('reviewedBy' in publicData.items[0]))
  assert.equal((await send(asset)).status, 200)
  assert.equal((await resolve('withdraw')).status, 200)
  assert.equal((await (await send('/admin/guestbook?status=reported', { headers: adminHeaders })).json()).total, 0)
  assert.equal((await like(true)).status, 404)
  assert.equal((await report()).status, 404)
  assert.equal((await (await send('/guestbook')).json()).total, 0)
  assert.equal((await send(asset)).status, 404)
  assert.equal((await (await send('/guestbook?featured=1')).json()).total, 0)
  assert.equal((await (await send('/guestbook/mine', { headers: { 'X-Guest-Key': key } })).json()).items[0].featured, false)
  // 新建连接验证提交和审核结果确实持久化。
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || 'root', database })
  try {
    const [rows] = await c.query('SELECT nickname, status, reviewed_by FROM guestbook_messages WHERE id = ?', [item.id])
    assert.equal(rows[0].nickname, ''); assert.equal(rows[0].status, 'rejected'); assert.equal(rows[0].reviewed_by, 'admin')
  } finally { await c.end() }
  assert.equal((await send(`/admin/guestbook/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 200)
  assert.equal((await (await send('/guestbook/mine', { headers: { 'X-Guest-Key': key } })).json()).total, 0)
  assert.equal((await send(asset, { headers: { 'X-Guest-Key': key } })).status, 404)
  const [orphans] = await pool.query('SELECT COUNT(*) AS total FROM guestbook_assets WHERE message_id = ?', [item.id])
  assert.equal(orphans[0].total, 0)
  for (const table of ['guestbook_likes', 'guestbook_reports']) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} WHERE message_id = ?`, [item.id])
    assert.equal(rows[0].total, 0)
  }
  console.log('PASS: MySQL migration + anonymous privacy + images + admin permissions + features + idempotent concurrent likes + hot/latest sorting + reports/deduplication/moderation + persistence + complete deletion')
} finally {
  if (server) await new Promise(resolve => server.close(resolve))
  await closeStore()
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || 'root' })
  try {
    if (!/^guestbook_check_[a-f0-9]{16}$/.test(database)) throw new Error('Unexpected test database')
    await c.query(`DROP DATABASE IF EXISTS \`${database}\``)
    console.log('Temporary test database removed')
  } finally { await c.end() }
}
