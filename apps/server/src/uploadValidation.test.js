// 文件作用：验证上传文件不会接受双重扩展名或伪造的文件内容。
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateUpload } from './services/uploadValidation.js'
import { prepareUpload } from './services/uploadService.js'
import { requireUploadPermission } from './middleware/uploadPermission.js'
import { validateAssetChanges } from './services/contentAssetPermissions.js'
import { parseBilibili } from '@artist-wiki/content-types'
import sharp from 'sharp'

test('rejects a double-extension executable disguised as an image', () => {
  const result = validateUpload({
    originalname: '1.jpg.exe',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff]),
  }, 'image')
  assert.equal(result.ok, false)
})

test('rejects a text payload renamed as jpg', () => {
  const result = validateUpload({
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('not an image'),
  }, 'image')
  assert.equal(result.ok, false)
})

test('accepts a valid PNG signature with an image MIME type', () => {
  const result = validateUpload({
    originalname: 'photo.png',
    mimetype: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  }, 'image')
  assert.equal(result.ok, true)
})

test('image processing rejects header-only or truncated images', async () => {
  const result = await prepareUpload({ originalname: 'photo.png', mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }, 'image')
  assert.equal(result.ok, false)
})

test('image processing decodes and re-encodes genuine images', async () => {
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#227365' } }).png().toBuffer()
  const result = await prepareUpload({ originalname: 'photo.png', mimetype: 'image/png', buffer }, 'image')
  assert.equal(result.ok, true)
  assert.equal((await sharp(result.buffer).metadata()).width, 8)
})

test('rejects extension/MIME mismatch and double extensions in both directions', () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff])
  for (const originalname of ['1.exe.jpg', '1.jpg.exe', 'file..jpg', '../file.jpg', 'file.jpg ', '.jpg', 'file\u202e.jpg']) {
    assert.equal(validateUpload({ originalname, mimetype: 'image/jpeg', buffer }, 'image').ok, false, originalname)
  }
  assert.equal(validateUpload({ originalname: 'photo.jpg', mimetype: 'image/png', buffer }, 'image').ok, false)
})

test('UTF-8 text imports return text without a public resource URL', async () => {
  const result = await prepareUpload({ originalname: 'intro.md', mimetype: 'text/markdown', buffer: Buffer.from('# 歌手简介\n正文') }, 'text')
  assert.equal(result.ok, true)
  assert.equal(result.result.text, '# 歌手简介\n正文')
  assert.equal(result.result.url, undefined)
})

test('rejects binary, invalid UTF-8, empty, oversized and renamed executable text', () => {
  for (const buffer of [Buffer.from([0xff, 0xfe, 0x80]), Buffer.from('MZ executable'), Buffer.from('x\0y'), Buffer.alloc(0), Buffer.alloc(1024 * 1024 + 1, 0x61)]) {
    assert.equal(validateUpload({ originalname: 'intro.txt', mimetype: 'text/plain', buffer }, 'text').ok, false)
  }
})

test('lyrics imports require time tags and music permission', async () => {
  assert.equal((await prepareUpload({ originalname: 'song.lrc', mimetype: 'application/octet-stream', buffer: Buffer.from('[00:01.20]测试歌词') }, 'lyrics')).ok, true)
  assert.equal(validateUpload({ originalname: 'song.lrc', mimetype: 'text/plain', buffer: Buffer.from('没有时间标签') }, 'lyrics').ok, false)
})

test('rejects local video files instead of treating music permission as video permission', () => {
  assert.equal(validateUpload({ originalname: 'video.mp4', mimetype: 'video/mp4', buffer: Buffer.alloc(100) }, 'video').ok, false)
})

test('Bilibili information imports normalize allowlisted embeds', async () => {
  const result = await prepareUpload({
    originalname: 'video.txt', mimetype: 'text/plain',
    buffer: Buffer.from('<iframe src="//player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=2" allowfullscreen></iframe>'),
  }, 'video')
  assert.equal(result.ok, true)
  assert.equal(result.result.bvid, 'BV1xx411c7mD')
  assert.equal(new URL(result.result.embedUrl).searchParams.get('page'), '2')
  assert.equal(parseBilibili('av123').bvid, 'av123')
  for (const input of ['https://evil.test/video/BV1xx411c7mD', 'javascript:alert(1)', '<script>alert(1)</script>', 'https://player.bilibili.com.evil.test/player.html?aid=123']) {
    assert.throws(() => parseBilibili(input))
  }
})

test('upload permission matrix permits only matching writers; read-only and admin cannot upload', () => {
  const permissionFor = { image: 'image.write', audio: 'music.write', text: 'text.write', lyrics: 'music.write', video: 'video.write' }
  const roles = [
    { role: 'admin', permissions: ['*', 'image.write', 'text.write', 'music.write', 'video.write'] },
    ...['text', 'image', 'music', 'video'].flatMap((scope) => [
      { role: 'editor', permissions: [`${scope}.read`] },
      { role: 'editor', permissions: [`${scope}.read`, `${scope}.write`] },
    ]),
  ]
  for (const actor of roles) for (const [category, permission] of Object.entries(permissionFor)) {
    let passed = false
    let status = 200
    requireUploadPermission({ actor, query: { category } }, { status(code) { status = code; return this }, json() {} }, () => { passed = true })
    const expected = actor.role !== 'admin' && actor.permissions.includes(permission)
    assert.equal(passed, expected, `${actor.role}: ${actor.permissions} -> ${category}`)
    assert.equal(status, expected ? 200 : 403)
  }
})

test('direct cover edits cannot bypass image permission', () => {
  const musicEditor = { role: 'editor', permissions: ['music.read', 'music.write'] }
  assert.equal(validateAssetChanges({ cover: '/old.png' }, { cover: '/old.png' }, musicEditor), '')
  assert.notEqual(validateAssetChanges({ cover: '/old.png' }, { cover: '/new.png' }, musicEditor), '')
  assert.equal(validateAssetChanges({}, { cover: '/new.png' }, { role: 'editor', permissions: ['image.write'] }), '')
})
