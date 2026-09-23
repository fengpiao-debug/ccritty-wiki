// 文件作用：Express 后端入口，提供公开内容、后台鉴权、权限控制和资源上传接口。
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import { authRequired, hashPassword, issueToken, verifyPassword } from './auth.js'
import { audit, cleanupAuditLogs, getAuditRetentionDays, getState, initStore, nextId, persist } from './store.js'
import { hydrateUser, requireContentRead, requireContentWrite, requirePermission } from './middleware/permissions.js'
import { can, permissionsForUser } from '@artist-wiki/permissions'
import { validateUserInput } from './services/userValidation.js'
import { deleteItem, getItem, getSnapshot, listContent, listVersions, restoreItem, saveItem } from './services/contentService.js'
import { decodeMultipartFilename, prepareUpload, saveUpload } from './services/uploadService.js'
import { requireUploadPermission } from './middleware/uploadPermission.js'
import { parseBilibili } from '@artist-wiki/content-types'
import { validateAssetChanges } from './services/contentAssetPermissions.js'
import { listImageAssets, updateImageAsset } from './services/imageAssetService.js'
import { BilibiliMetadataError, resolveBilibiliMetadata } from './services/bilibiliMetadataService.js'

const app = express()
const port = Number(process.env.PORT || 3007)
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
})
const loginAttempts = new Map()
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.WEB_ORIGIN,
].filter(Boolean))

app.disable('x-powered-by')
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    callback(new Error('不允许的跨域来源'))
  },
}))
app.use(express.json({ limit: '5mb' }))
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

app.get('/api/health', (_request, response) => response.json({ ok: true }))
app.get('/api/content', (_request, response) => {
  const content = listContent()
  for (const [key, value] of Object.entries(content)) {
    if (Array.isArray(value)) content[key] = value.filter((item) => !item.deletedAt)
  }
  response.json(content)
})

app.post('/api/auth/login', async (request, response) => {
  const ip = request.ip || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const attempt = loginAttempts.get(ip) || { count: 0, startedAt: now }
  if (now - attempt.startedAt > 15 * 60 * 1000) {
    attempt.count = 0
    attempt.startedAt = now
  }
  attempt.count += 1
  loginAttempts.set(ip, attempt)
  if (attempt.count > 8) return response.status(429).json({ message: '登录尝试过于频繁，请稍后再试' })

  const username = String(request.body?.username || '').trim()
  const password = String(request.body?.password || '')
  if (!/^[\w-]{3,80}$/u.test(username) || password.length < 8 || password.length > 200) {
    response.status(400).json({ message: '账号或密码格式不正确' })
    return
  }
  const user = getState().users.find((item) => item.username === username)
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) return response.status(401).json({ message: '账号或密码错误' })
  loginAttempts.delete(ip)
  const { password: legacyPassword, passwordHash, passwordSalt, ...safeUser } = user
  await audit({ actor: user.username, action: 'auth.login', target: 'user', targetId: user.id })
  response.json({ token: issueToken(user), user: { ...safeUser, permissions: permissionsForUser(user) } })
})

app.get('/api/auth/me', authRequired, hydrateUser, (request, response) => {
  const { password, passwordHash, passwordSalt, ...user } = request.actor
  response.json({ user })
})

app.use('/api/admin', authRequired, hydrateUser)
app.get('/api/admin/content', (request, response) => {
  const scopes = { profile: 'text', news: 'text', events: 'text', photos: 'image', songs: 'music', videos: 'video' }
  const allowed = Object.entries(listContent()).filter(([key]) => can(request.actor.permissions, `${scopes[key]}.read`))
  if (!allowed.length) return response.status(403).json({ message: '当前账号没有内容查看权限' })
  response.json(Object.fromEntries(allowed))
})
app.get('/api/admin/image-assets', (request, response) => {
  const result = listImageAssets(request.actor)
  if (!result) return response.status(403).json({ message: '当前账号没有图片查看权限' })
  response.json(result)
})
app.put('/api/admin/image-assets/:type/:id', async (request, response) => {
  if (typeof request.body?.url !== 'string') return response.status(400).json({ message: '请提供图片地址' })
  const result = await updateImageAsset(request.params.type, request.params.id, request.body.url, request.actor)
  if (result.status) return response.status(result.status).json({ message: result.message })
  response.json({ item: result.item })
})
app.post('/api/admin/videos/resolve', requirePermission('video.write'), async (request, response) => {
  try {
    const source = request.body?.source ?? request.body?.url ?? request.body?.bvid ?? request.body?.embedUrl
    response.json(await resolveBilibiliMetadata(source))
  } catch (error) {
    if (error instanceof BilibiliMetadataError) return response.status(error.status).json({ message: error.message })
    response.status(502).json({ message: 'B 站视频解析失败' })
  }
})
app.get('/api/admin/users', requirePermission('user.manage'), (_request, response) => response.json({ items: getState().users.map(({ password, passwordHash, passwordSalt, ...user }) => ({ ...user, permissions: permissionsForUser(user) })) }))
app.get('/api/admin/audit-logs', requirePermission('user.manage'), (_request, response) => {
  const users = new Map(getState().users.map((user) => [user.username, user.displayName]))
  const items = getState().audit.map((item) => {
    const metadata = item.metadata ? {
      ...item.metadata,
      fileName: item.metadata.fileName ? decodeMultipartFilename(item.metadata.fileName) : item.metadata.fileName,
    } : item.metadata
    return {
      ...item,
      metadata,
      actorName: users.get(item.actor) || item.actor,
    }
  })
  response.json({ items, retentionDays: getAuditRetentionDays() })
})

app.post('/api/admin/users', requirePermission('user.manage'), async (request, response) => {
  const { username, displayName, password, permissions = [] } = request.body || {}
  const invalid = validateUserInput(request.body || {}, true)
  if (invalid) return response.status(400).json({ message: invalid })
  if (getState().users.some((user) => user.username.toLowerCase() === username.toLowerCase())) return response.status(409).json({ message: '账号已存在' })
  const credentials = hashPassword(password)
  const user = { id: nextId('user'), username, displayName, role: 'editor', permissions, ...{ passwordHash: credentials.hash, passwordSalt: credentials.salt } }
  getState().users.push(user); await persist(); await audit({
    actor: request.actor.username,
    action: 'user.create',
    target: 'user',
    targetId: user.id,
    metadata: { username, displayName, role: user.role, permissions },
  })
  response.status(201).json({ item: { id: user.id, username, displayName, role: user.role, permissions } })
})

app.put('/api/admin/users/:id', requirePermission('user.manage'), async (request, response) => {
  const user = getState().users.find((item) => item.id === request.params.id)
  if (!user) return response.status(404).json({ message: '用户不存在' })
  if (user.role === 'admin') return response.status(403).json({ message: '系统管理员账号不参与内容授权，不能通过此入口修改' })
  const { displayName, permissions, password } = request.body || {}
  const invalid = validateUserInput(request.body || {})
  if (invalid) return response.status(400).json({ message: invalid })
  if (displayName) user.displayName = displayName
  if (Array.isArray(permissions)) user.permissions = permissions
  if (password) {
    const credentials = hashPassword(password)
    user.passwordHash = credentials.hash
    user.passwordSalt = credentials.salt
  }
  await persist()
  await audit({
    actor: request.actor.username,
    action: 'user.update',
    target: 'user',
    targetId: user.id,
    metadata: { username: user.username, displayName: user.displayName, permissions: user.permissions },
  })
  const { passwordHash, passwordSalt, password: legacyPassword, ...safeUser } = user
  response.json({ item: safeUser })
})

app.delete('/api/admin/users/:id', requirePermission('user.manage'), async (request, response) => {
  if (request.params.id === request.actor.id) return response.status(400).json({ message: '不能删除当前账号' })
  const target = getState().users.find((user) => user.id === request.params.id)
  if (!target) return response.status(404).json({ message: '用户不存在' })
  if (target.role === 'admin') return response.status(403).json({ message: '不能删除系统管理员' })
  getState().users = getState().users.filter((user) => user.id !== request.params.id)
  await persist()
  await audit({
    actor: request.actor.username,
    action: 'user.delete',
    target: 'user',
    targetId: request.params.id,
    metadata: { username: target.username, displayName: target.displayName },
  })
  response.json({ ok: true })
})

app.post('/api/admin/locks/:type/:id', requireContentWrite, async (request, response) => {
  const now = Date.now()
  getState().locks = getState().locks.filter((lock) => new Date(lock.expiresAt).getTime() > now)
  const existing = getState().locks.find((lock) => lock.type === request.params.type && lock.contentId === request.params.id)
  if (existing && existing.userId !== request.actor.id) return response.status(423).json({ message: `内容正在被 ${existing.username} 编辑` })
  const lock = { type: request.params.type, contentId: request.params.id, userId: request.actor.id, username: request.actor.username, expiresAt: new Date(now + 30 * 60 * 1000).toISOString() }
  getState().locks = getState().locks.filter((item) => !(item.type === lock.type && item.contentId === lock.contentId)); getState().locks.push(lock)
  await persist(); response.json({ lock })
})

app.delete('/api/admin/locks/:type/:id', async (request, response) => {
  getState().locks = getState().locks.filter((lock) => !(lock.type === request.params.type && lock.contentId === request.params.id && (lock.userId === request.actor.id || request.actor.role === 'admin')))
  await persist(); response.json({ ok: true })
})

app.put('/api/admin/content/:type/:id', requireContentWrite, async (request, response) => {
  const lock = getState().locks.find((item) => item.type === request.params.type && item.contentId === request.params.id)
  if (!lock || lock.userId !== request.actor.id || new Date(lock.expiresAt).getTime() <= Date.now()) return response.status(423).json({ message: '编辑锁已失效，请重新打开编辑' })
  const assetError = validateAssetChanges(getItem(request.params.type, request.params.id), request.body || {}, request.actor, request.params.type)
  if (assetError) return response.status(403).json({ message: assetError })
  if (request.params.type === 'video') {
    try {
      const source = request.body?.embedUrl || request.body?.bvid
      if (source) Object.assign(request.body, parseBilibili(source))
    } catch (error) { return response.status(400).json({ message: error.message }) }
  }
  const item = await saveItem(request.params.type, request.params.id, request.body, request.actor, request.body?.changeSummary || '更新内容')
  getState().locks = getState().locks.filter((item) => !(item.type === request.params.type && item.contentId === request.params.id))
  await audit({
    actor: request.actor.username,
    action: 'content.save',
    target: request.params.type,
    targetId: request.params.id,
    metadata: { title: item.title || item.artistName || item.id, changeSummary: request.body?.changeSummary || '更新内容' },
  })
  response.json({ item })
})

app.delete('/api/admin/content/:type/:id', requireContentWrite, async (request, response) => {
  const lock = getState().locks.find((item) => item.type === request.params.type && item.contentId === request.params.id)
  if (!lock || lock.userId !== request.actor.id || new Date(lock.expiresAt).getTime() <= Date.now()) return response.status(423).json({ message: '请先获得该内容的编辑锁' })
  const item = await deleteItem(request.params.type, request.params.id, request.actor)
  if (!item) return response.status(404).json({ message: '内容不存在' })
  getState().locks = getState().locks.filter((item) => !(item.type === request.params.type && item.contentId === request.params.id))
  await audit({
    actor: request.actor.username,
    action: 'content.delete',
    target: request.params.type,
    targetId: request.params.id,
    metadata: { title: item.title || item.artistName || item.id },
  })
  response.json({ item })
})

app.get('/api/admin/content/:type/:id/versions', requireContentRead, requirePermission('content.rollback'), (request, response) => response.json({ items: listVersions(request.params.type, request.params.id) }))
app.get('/api/admin/content/:type/:id/versions/:versionId', requireContentRead, requirePermission('content.rollback'), (request, response) => response.json({ item: getSnapshot(request.params.type, request.params.id, request.params.versionId) }))
app.post('/api/admin/content/:type/:id/restore/:versionId', requireContentWrite, requirePermission('content.rollback'), async (request, response) => {
  const lock = getState().locks.find((item) => item.type === request.params.type && item.contentId === request.params.id)
  if (!lock || lock.userId !== request.actor.id || new Date(lock.expiresAt).getTime() <= Date.now()) return response.status(423).json({ message: '请先获得该内容的编辑锁' })
  const snapshot = getSnapshot(request.params.type, request.params.id, request.params.versionId)
  if (!snapshot) return response.status(404).json({ message: '历史版本不存在' })
  const assetError = validateAssetChanges(getItem(request.params.type, request.params.id), snapshot, request.actor, request.params.type)
  if (assetError) return response.status(403).json({ message: assetError })
  const item = await restoreItem(request.params.type, request.params.id, request.params.versionId, request.actor)
  getState().locks = getState().locks.filter((item) => !(item.type === request.params.type && item.contentId === request.params.id))
  await audit({
    actor: request.actor.username,
    action: 'content.restore',
    target: request.params.type,
    targetId: request.params.id,
    versionId: request.params.versionId,
    metadata: { title: item.title || item.artistName || item.id },
  })
  response.json({ item })
})

app.post('/api/admin/upload', requireUploadPermission, upload.single('file'), async (request, response) => {
  if (!request.file) return response.status(400).json({ message: '缺少文件' })
  request.file.originalname = decodeMultipartFilename(request.file.originalname)
  const category = request.query.category
  const prepared = await prepareUpload(request.file, category)
  if (!prepared.ok) return response.status(400).json({ message: prepared.message })
  // 权限可能在耗时的解码期间被管理员收回，写入前再次检查当前账号。
  const actor = getState().users.find((user) => user.id === request.actor.id)
  let stillAllowed = false
  requireUploadPermission({ actor, query: request.query }, response, () => { stillAllowed = true })
  if (!stillAllowed) return
  const saved = prepared.result || await saveUpload(prepared, category)
  const result = prepared.result ? { ...prepared.result, metadata: prepared.result.metadata || null } : { ...saved, metadata: prepared.metadata || null }
  await audit({
    actor: request.actor.username,
    action: prepared.result ? 'asset.import' : 'asset.upload',
    target: category,
    targetId: result.url || category,
    metadata: { category, fileName: request.file.originalname, url: result.url || '', imported: Boolean(prepared.result) },
  })
  response.status(201).json(result)
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? '上传文件超过 25MB 限制' : '每次只能上传一个文件，字段名必须为 file' })
    return
  }
  response.status(500).json({ message: '服务异常' })
})

await initStore()
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 32)) {
  throw new Error('生产环境必须配置长度至少 32 位的 ADMIN_JWT_SECRET')
}
const auditCleanupTimer = setInterval(() => {
  cleanupAuditLogs().catch((error) => console.error('[artist-wiki] audit cleanup failed', error))
}, 24 * 60 * 60 * 1000)
auditCleanupTimer.unref()
app.listen(port, () => console.log(`[artist-wiki] server listening on http://localhost:${port}; audit retention ${getAuditRetentionDays()} days`))
