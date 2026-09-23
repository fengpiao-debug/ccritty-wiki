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
const imageUsername = `qa-image-${crypto.randomBytes(5).toString('hex')}`
const videoUsername = `qa-video-${crypto.randomBytes(5).toString('hex')}`
const temporaryUsers = []
const files = []
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')
let coverRestore
let temporaryVideoId
let temporarySongId
let imageEditorToken
let videoEditorToken
let musicEditorToken

async function upload(token, category, name, mime, bytes) {
  const body = new FormData()
  body.append('file', new Blob([bytes], { type: mime }), name)
  const result = await request(`/api/admin/upload?category=${category}`, { token, method: 'POST', body })
  if (result.body.url) files.push(result.body.url)
  return result
}
async function createEditor(username, permissions) {
  const created = await request('/api/admin/users', { method: 'POST', token: admin.body.token, body: { username, password, displayName: '权限接口临时测试', permissions } })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id = created.body.item.id
  temporaryUsers.push(id)
  const login = await request('/api/auth/login', { method: 'POST', body: { username, password } })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return { id, token: login.body.token }
}
try {
  const textEditor = await createEditor(`qa-text-${crypto.randomBytes(5).toString('hex')}`, ['text.read', 'text.write'])
  let result = await upload(textEditor.token, 'text', 'intro.md', 'text/markdown', '# Wiki\n测试正文')
  assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(result.body.text, '# Wiki\n测试正文')
  assert.equal((await upload(textEditor.token, 'audio', 'song.mp3', 'audio/mpeg', 'ID3invalid')).status, 403)
  console.log('PASS text: Markdown import, cross-domain audio denied')

  const musicEditor = await createEditor(`qa-music-${crypto.randomBytes(5).toString('hex')}`, ['music.read', 'music.write'])
  musicEditorToken = musicEditor.token
  temporarySongId = `qa-song-${crypto.randomUUID()}`
  const songLock = await request(`/api/admin/locks/song/${temporarySongId}`, { method: 'POST', token: musicEditorToken })
  assert.equal(songLock.status, 200, JSON.stringify(songLock.body))
  const temporarySong = await request(`/api/admin/content/song/${temporarySongId}`, {
    method: 'PUT', token: musicEditorToken,
    body: { title: '临时封面权限验证', artist: 'Codex QA', cover: '', audioUrl: '', description: '自动化测试数据' },
  })
  assert.equal(temporarySong.status, 200, JSON.stringify(temporarySong.body))

  const editor = await createEditor(imageUsername, ['image.read', 'image.write'])
  const token = editor.token
  imageEditorToken = token
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

  // 独立图片权限应允许上传并更新歌曲封面，但不授予歌曲内容或音频维护能力。
  const imageAssets = await request('/api/admin/image-assets', { token })
  assert.equal(imageAssets.status, 200, JSON.stringify(imageAssets.body))
  const song = imageAssets.body.items.find((item) => item.type === 'song' && item.id === temporarySongId)
  assert.ok(song, '缺少临时歌曲图片资源记录')
  const originalCover = song.url
  coverRestore = originalCover
  const replacementCover = files.find((url) => url.startsWith('/uploads/images/'))
  const changedCover = await request(`/api/admin/image-assets/song/${temporarySongId}`, { method: 'PUT', token, body: { url: replacementCover } })
  assert.equal(changedCover.status, 200, JSON.stringify(changedCover.body))
  assert.equal(changedCover.body.item.cover, replacementCover)
  assert.equal((await request(`/api/admin/content/song/${temporarySongId}`, { method: 'PUT', token, body: { title: '不应被修改' } })).status, 403)
  assert.equal(changedCover.body.item.title, '临时封面权限验证')
  assert.equal((await upload(token, 'audio', 'image-editor.wav', 'audio/wav', Buffer.alloc(44))).status, 403)
  const restoredCover = await request(`/api/admin/image-assets/song/${temporarySongId}`, { method: 'PUT', token, body: { url: originalCover } })
  assert.equal(restoredCover.status, 200, JSON.stringify(restoredCover.body))
  assert.equal(restoredCover.body.item.cover, originalCover)
  coverRestore = undefined
  console.log('PASS image-only editor: image upload and song-cover update allowed; song/audio edit denied; cover restored')

  const musicToken = musicEditorToken
  const wav = Buffer.alloc(44 + 16000)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(16000, 40)
  result = await upload(musicToken, 'audio', 'silence.wav', 'audio/wav', wav)
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const audioAsset = await fetch(`${base}${result.body.url}`, { headers: { Range: 'bytes=0-43' } })
  assert.equal(audioAsset.status, 206, '音频拖动需要支持 Range')
  result = await upload(musicToken, 'lyrics', 'lyrics.lrc', 'text/plain', '[00:01.00]歌词')
  assert.equal(result.status, 201)
  assert.equal(result.body.text, '[00:01.00]歌词')
  assert.equal((await upload(musicToken, 'image', 'photo.png', 'image/png', image)).status, 403)
  console.log('PASS music: audio + LRC import, Range seeking, image permission isolated')

  const videoEditor = await createEditor(videoUsername, ['video.read', 'video.write'])
  const videoToken = videoEditor.token
  videoEditorToken = videoToken
  result = await upload(videoToken, 'video', 'video.txt', 'text/plain', 'https://www.bilibili.com/video/BV1xx411c7mD/')
  assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(result.body.bvid, 'BV1xx411c7mD')
  assert.equal(new URL(result.body.embedUrl).hostname, 'player.bilibili.com')
  assert.equal((await upload(videoToken, 'video', 'video.txt', 'text/plain', '<iframe src="https://evil.test"></iframe>')).status, 400)
  assert.equal((await upload(videoToken, 'video', 'video.mp4', 'video/mp4', 'fake video')).status, 400)
  temporaryVideoId = `qa-video-${crypto.randomUUID()}`
  const lock = await request(`/api/admin/locks/video/${temporaryVideoId}`, { method: 'POST', token: videoToken })
  assert.equal(lock.status, 200, JSON.stringify(lock.body))
  const videoSave = await request(`/api/admin/content/video/${temporaryVideoId}`, {
    method: 'PUT', token: videoToken,
    body: { ...result.body, title: '临时 B 站解析验证', description: '自动化测试内容', changeSummary: '验证视频权限与保存' },
  })
  assert.equal(videoSave.status, 200, JSON.stringify(videoSave.body))
  assert.equal(videoSave.body.item.bvid, 'BV1xx411c7mD')
  assert.equal(videoSave.body.item.embedUrl, result.body.embedUrl)
  assert.equal((await request('/api/admin/image-assets', { token: videoToken })).status, 403)
  assert.equal((await request(`/api/admin/image-assets/video/${temporaryVideoId}`, { method: 'PUT', token: videoToken, body: { url: replacementCover } })).status, 403)
  const updateLock = await request(`/api/admin/locks/video/${temporaryVideoId}`, { method: 'POST', token: videoToken })
  assert.equal(updateLock.status, 200, JSON.stringify(updateLock.body))
  const videoUpdate = await request(`/api/admin/content/video/${temporaryVideoId}`, {
    method: 'PUT', token: videoToken,
    body: { ...result.body, title: '临时 B 站解析验证（已更新）', description: '更新后的自动化测试内容', changeSummary: '验证视频内容更新' },
  })
  assert.equal(videoUpdate.status, 200, JSON.stringify(videoUpdate.body))
  assert.equal(videoUpdate.body.item.title, '临时 B 站解析验证（已更新）')
  assert.equal(videoUpdate.body.item.bvid, 'BV1xx411c7mD')
  const deleteLock = await request(`/api/admin/locks/video/${temporaryVideoId}`, { method: 'POST', token: videoToken })
  assert.equal(deleteLock.status, 200, JSON.stringify(deleteLock.body))
  const removedVideo = await request(`/api/admin/content/video/${temporaryVideoId}`, { method: 'DELETE', token: videoToken })
  assert.equal(removedVideo.status, 200, JSON.stringify(removedVideo.body))
  temporaryVideoId = undefined
  console.log('PASS video editor: Bilibili upload parsing and content save allowed; image asset access/edit denied; temporary video archived')

  const readOnlyEditor = await createEditor(`qa-readonly-${crypto.randomBytes(5).toString('hex')}`, ['music.read'])
  assert.equal((await upload(readOnlyEditor.token, 'audio', 'silence.wav', 'audio/wav', wav)).status, 403)
  assert.equal((await upload(admin.body.token, 'image', 'photo.png', 'image/png', image)).status, 403)
  assert.equal((await upload(null, 'image', 'photo.png', 'image/png', image)).status, 401)
  console.log('PASS permissions: read-only, admin and unauthenticated uploads denied')
} finally {
  if (coverRestore !== undefined) {
    const restored = await request(`/api/admin/image-assets/song/${temporarySongId}`, { method: 'PUT', token: imageEditorToken, body: { url: coverRestore } })
    assert.equal(restored.status, 200, `歌曲封面恢复失败: ${JSON.stringify(restored.body)}`)
  }
  if (temporarySongId) {
    const lock = await request(`/api/admin/locks/song/${temporarySongId}`, { method: 'POST', token: musicEditorToken })
    if (lock.status === 200) await request(`/api/admin/content/song/${temporarySongId}`, { method: 'DELETE', token: musicEditorToken })
  }
  if (temporaryVideoId) {
    await request(`/api/admin/locks/video/${temporaryVideoId}`, { token: videoEditorToken, method: 'DELETE' })
    const lock = await request(`/api/admin/locks/video/${temporaryVideoId}`, { method: 'POST', token: videoEditorToken })
    if (lock.status === 200) await request(`/api/admin/content/video/${temporaryVideoId}`, { method: 'DELETE', token: videoEditorToken })
  }
  for (const id of temporaryUsers) {
    const removed = await request(`/api/admin/users/${id}`, { token: admin.body.token, method: 'DELETE' })
    assert.ok([200, 404].includes(removed.status), `临时账号清理失败: ${id}`)
  }
  for (const url of files) {
    if (!/^\/uploads\/(images|audio)\/[a-f0-9-]+\.(png|wav)$/.test(url)) throw new Error('拒绝清理意外路径')
    const target = path.resolve(root, url.slice('/uploads/'.length))
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('测试资源越出上传目录')
    await fs.unlink(target)
  }
  console.log('Temporary account and generated test resources cleaned up')
}
