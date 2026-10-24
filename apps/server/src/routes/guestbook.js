import express from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { validateUpload } from '../services/uploadValidation.js'

const ownerHash = request => {
  const key = request.get('X-Guest-Key') || ''
  return /^[a-f0-9]{64}$/.test(key) ? crypto.createHash('sha256').update(key).digest('hex') : null
}
const adminOnly = (req, res, next) => req.actor?.role === 'admin' ? next() : res.status(403).json({ message: '仅管理员可管理留言' })

export function createGuestbookRouter({ store, authenticateAdmin }) {
  const router = express.Router()
  const attempts = new Map()
  const interactions = new Map()
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: 4, fileSize: 2 * 1024 * 1024, fields: 3, fieldSize: 24000, parts: 7 } }).array('files', 4)
  router.use(['/guestbook', '/admin/guestbook'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.get('/guestbook', async (req, res) => res.json(await store.list({ page: pageNumber(req.query.page), featuredOnly: req.query.featured === '1', viewer: ownerHash(req), sort: req.query.sort === 'hot' ? 'hot' : 'latest' })))
  router.get('/guestbook/mine', async (req, res) => {
    const owner = ownerHash(req)
    if (!owner) return res.status(400).json({ message: '缺少本人预览凭证，请刷新重试' })
    res.json(await store.list({ owner, page: pageNumber(req.query.page), sort: req.query.sort === 'hot' ? 'hot' : 'latest' }))
  })
  function interactionLimit(req, res, next) {
    if (!ownerHash(req)) return res.status(400).json({ message: '缺少匿名凭证，请刷新页面重试' })
    const now = Date.now()
    for (const [key, item] of interactions) if (now - item.start > 3600000) interactions.delete(key)
    const item = interactions.get(req.ip) || { start: now, count: 0 }
    if (item.count >= 120) return res.status(429).json({ message: '操作过于频繁，请稍后再试' })
    item.count++; interactions.set(req.ip, item); next()
  }
  router.put('/guestbook/:id/like', interactionLimit, async (req, res) => {
    if (typeof req.body?.liked !== 'boolean') return res.status(400).json({ message: '点赞状态无效' })
    const result = await store.interact(req.params.id, ownerHash(req), 'like', req.body.liked)
    if (!result) return res.status(404).json({ message: '留言不存在或尚未公开' })
    res.json(result)
  })
  router.post('/guestbook/:id/report', interactionLimit, async (req, res) => {
    if (!['spam', 'abuse', 'copyright', 'other'].includes(req.body?.reason)) return res.status(400).json({ message: '请选择举报原因' })
    const result = await store.interact(req.params.id, ownerHash(req), 'report', req.body.reason)
    if (!result) return res.status(404).json({ message: '留言不存在或尚未公开' })
    res.json({ ...result, message: '举报已提交，管理员会核查处理。' })
  })
  router.post('/guestbook', (req, res, next) => {
    if (!ownerHash(req)) return res.status(400).json({ message: '缺少本人预览凭证，请刷新重试' })
    const now = Date.now()
    for (const [key, value] of attempts) if (now - value.start > 3600000) attempts.delete(key)
    const key = req.ip
    const attempt = attempts.get(key) || { start: now, count: 0 }
    if (attempt.count >= 12) return res.status(429).json({ message: '留言过于频繁，请一小时后再试' })
    attempt.count++; attempts.set(key, attempt)
    next()
  }, upload, async (req, res) => {
    const markdown = typeof req.body?.markdown === 'string' ? req.body.markdown.trim() : ''
    if (markdown.length > 5000 || (!markdown && !req.files?.length)) {
      return res.status(400).json({ message: '请填写留言（最多 5000 字），也可仅上传图片或表情' })
    }
    let kinds
    try { kinds = JSON.parse(req.body.kinds || '[]') } catch { return res.status(400).json({ message: '附件格式错误' }) }
    if (!Array.isArray(kinds) || kinds.length !== (req.files?.length || 0) || kinds.some(kind => !['image', 'emoji'].includes(kind))) return res.status(400).json({ message: '附件格式错误' })
    const assets = []
    for (const [index, file] of (req.files || []).entries()) {
      const valid = validateUpload(file, 'image')
      if (!valid.ok) return res.status(400).json({ message: valid.message })
      try {
        // 解码并重新编码，保留 GIF 动画；限制像素和帧，防止解压炸弹。
        const options = { animated: true, limitInputPixels: 16000000 }
        const metadata = await sharp(file.buffer, options).metadata()
        if ((metadata.pages || 1) > 100 || metadata.width * metadata.height > 16000000) throw new Error()
        const data = await sharp(file.buffer, options).resize({ width: kinds[index] === 'emoji' ? 160 : 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
        if (data.length > 4 * 1024 * 1024) throw new Error()
        assets.push({ id: crypto.randomUUID(), kind: kinds[index], mime: 'image/webp', data })
      } catch { return res.status(400).json({ message: '图片无法读取或尺寸过大，请换一张图片' }) }
    }
    const item = { id: crypto.randomUUID(), markdown, status: 'pending', featured: false, createdAt: new Date().toISOString() }
    await store.create({ ...item, owner: ownerHash(req) }, assets)
    res.status(201).json({ item: { ...item, assets: assets.map(({ id, kind }) => ({ id, kind })) }, message: '留言已提交，审核通过后公开。现在仅你可预览。' })
  })
  async function serveAsset(req, res, admin = false) {
    const asset = await store.asset(req.params.id)
    if (!asset || (!admin && asset.status !== 'approved' && asset.owner !== ownerHash(req))) return res.status(404).json({ message: '图片不存在' })
    res.set('X-Content-Type-Options', 'nosniff')
      .set('Content-Security-Policy', "default-src 'none'; sandbox")
      .set('Cross-Origin-Resource-Policy', 'same-site')
      .type('image/webp').send(asset.data)
  }
  router.get('/guestbook/assets/:id', (req, res) => serveAsset(req, res))
  router.use('/admin/guestbook', ...authenticateAdmin, adminOnly)
  router.get('/admin/guestbook', async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending'
    res.json(await store.list({ admin: true, status: req.query.status === 'featured' ? 'approved' : status, featuredOnly: req.query.status === 'featured', reportedOnly: req.query.status === 'reported', page: pageNumber(req.query.page) }))
  })
  router.get('/admin/guestbook/assets/:id', (req, res) => serveAsset(req, res, true))
  router.patch('/admin/guestbook/:id', async (req, res) => {
    if (!['approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ message: '无效的审核状态' })
    if (!await store.review(req.params.id, req.body.status, req.actor.username)) return res.status(404).json({ message: '留言不存在' })
    res.json({ ok: true })
  })
  router.patch('/admin/guestbook/:id/featured', async (req, res) => {
    if (typeof req.body?.featured !== 'boolean') return res.status(400).json({ message: '精选状态必须为布尔值' })
    if (!await store.setFeatured(req.params.id, req.body.featured)) return res.status(409).json({ message: '只能对已公开的留言设置精选，请刷新列表' })
    res.json({ ok: true })
  })
  router.delete('/admin/guestbook/:id', async (req, res) => {
    if (!await store.remove(req.params.id)) return res.status(404).json({ message: '留言不存在或已删除' })
    res.json({ ok: true })
  })
  router.patch('/admin/guestbook/:id/reports', async (req, res) => {
    if (!['dismiss', 'withdraw'].includes(req.body?.action)) return res.status(400).json({ message: '举报处理方式无效' })
    if (!await store.resolveReports(req.params.id, req.body.action, req.actor.username)) return res.status(404).json({ message: '留言不存在或已删除' })
    res.json({ ok: true })
  })
  router.use((error, _req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ message: '最多上传 4 张图片或表情，单张不超过 2MB' })
    next(error)
  })
  return router
}

function pageNumber(value) { return Math.min(100000, Math.max(1, Number.parseInt(value, 10) || 1)) }
