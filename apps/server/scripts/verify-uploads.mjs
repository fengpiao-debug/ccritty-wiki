// 文件作用：本地上传接口端到端验证；创建临时编辑者测试各领域权限，完成后删除测试账号及本脚本生成的资源。
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const base = process.env.QA_API_URL || 'http://localhost:3007'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('此测试仅允许本地服务器')
const adminCredentials = { username: process.env.QA_ADMIN_USER || 'admin', password: process.env.QA_ADMIN_PASSWORD || 'admin123456' }
async function request(url, { token, body, method = 'GET' } = {}) {
  const response = await fetch(`${base}${url}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined,
  })
  return { status: response.status, body: await response.json() }
}
const admin = await request('/api/auth/login', { method: 'POST', body: adminCredentials })
assert.equal(admin.status, 200, '管理员登录失败')
const password = crypto.randomUUID()
const username = `qa-${crypto.randomBytes(6).toString('hex')}`
let id
const files = []
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')

async function upload(token, category, name, mime, bytes) {
  const body = new FormData()
  body.append('file', new Blob([bytes], { type: mime }), name)
  const result = await request(`/api/admin/upload?category=${category}`, { token, method: 'POST', body })
  if (result.body.url) files.push(result.body.url)
  return result
}
try {
  const created = await request('/api/admin/users', { method: 'POST', token: admin.body.token, body: { username, password, displayName: '上传接口临时测试', permissions: ['text.read', 'text.write'] } })
  assert.equal(created.status, 201)
  id = created.body.item.id
  const editor = await request('/api/auth/login', { method: 'POST', body: { username, password } })
  const token = editor.body.token
  const configure = async (permissions) => {
    const result = await request(`/api/admin/users/${id}`, { method: 'PUT', token: admin.body.token, body: { displayName: '上传接口临时测试', permissions } })
    assert.equal(result.status, 200)
  }
  let result = await upload(token, 'text', 'intro.md', 'text/markdown', '# Wiki\n测试正文')
  assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(result.body.text, '# Wiki\n测试正文')
  assert.equal((await upload(token, 'audio', 'song.mp3', 'audio/mpeg', 'ID3invalid')).status, 403)
  console.log('PASS text: Markdown import, cross-domain audio denied')

  await configure(['image.read', 'image.write'])
  const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#227365' } }).png().toBuffer()
  result = await upload(token, 'image', 'photo.png', 'image/png', image)
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const asset = await fetch(`${base}${result.body.url}`)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await sharp(Buffer.from(await asset.arrayBuffer())).metadata()).width, 16)
  for (const [name, mime, bytes] of [['1.jpg.exe', 'image/jpeg', image], ['evil.exe.png', 'image/png', image], ['fake.png', 'image/png', Buffer.from('MZfake')], ['mime.png', 'image/jpeg', image]]) {
    assert.equal((await upload(token, 'image', name, mime, bytes)).status, 400)
  }
  console.log('PASS image: real multipart upload, static preview and disguise rejection')

  await configure(['music.read', 'music.write'])
  const wav = Buffer.alloc(44 + 16000)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(16000, 40)
  result = await upload(token, 'audio', 'silence.wav', 'audio/wav', wav)
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const audioAsset = await fetch(`${base}${result.body.url}`, { headers: { Range: 'bytes=0-43' } })
  assert.equal(audioAsset.status, 206, '音频拖动需要支持 Range')
  result = await upload(token, 'lyrics', 'lyrics.lrc', 'text/plain', '[00:01.00]歌词')
  assert.equal(result.status, 201)
  assert.equal(result.body.text, '[00:01.00]歌词')
  assert.equal((await upload(token, 'image', 'photo.png', 'image/png', image)).status, 403)
  console.log('PASS music: audio + LRC import, Range seeking, image permission isolated')

  await configure(['video.read', 'video.write'])
  result = await upload(token, 'video', 'video.txt', 'text/plain', 'https://www.bilibili.com/video/BV1xx411c7mD/')
  assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(new URL(result.body.embedUrl).hostname, 'player.bilibili.com')
  assert.equal((await upload(token, 'video', 'video.txt', 'text/plain', '<iframe src="https://evil.test"></iframe>')).status, 400)
  assert.equal((await upload(token, 'video', 'video.mp4', 'video/mp4', 'fake video')).status, 400)
  console.log('PASS video: Bilibili import, external iframe and local video rejected')

  await configure(['music.read'])
  assert.equal((await upload(token, 'audio', 'silence.wav', 'audio/wav', wav)).status, 403)
  assert.equal((await upload(admin.body.token, 'image', 'photo.png', 'image/png', image)).status, 403)
  assert.equal((await upload(null, 'image', 'photo.png', 'image/png', image)).status, 401)
  console.log('PASS permissions: read-only, admin and unauthenticated uploads denied')
} finally {
  if (id) await request(`/api/admin/users/${id}`, { token: admin.body.token, method: 'DELETE' })
  for (const url of files) {
    if (!/^\/uploads\/(images|audio)\/[a-f0-9-]+\.(png|wav)$/.test(url)) throw new Error('拒绝清理意外路径')
    const target = path.resolve(root, url.slice('/uploads/'.length))
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('测试资源越出上传目录')
    await fs.unlink(target)
  }
  console.log('Temporary account and generated test resources cleaned up')
}
