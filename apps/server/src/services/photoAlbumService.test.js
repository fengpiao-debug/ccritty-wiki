import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhotoAlbum, matchesPhotoAlbum, publicPhotoAlbum } from '@artist-wiki/content-types'
import { preparePhotoAlbum } from './photoAlbumService.js'
import { validateAssetChanges } from './contentAssetPermissions.js'

const album = () => ({ id: 'album-1', title: '秋日音乐节', description: '返场记录', category: 'event',
  authorType: 'fan', authorName: '摄影小林', fanId: 'SecretCC123', showFanId: false, publishedAt: '2026-10-02T19:30', location: '杭州主舞台',
  coverImageId: 'b', images: [{ id: 'a', url: '/uploads/images/a.jpg', keywords: '红裙 灯光', description: '侧颜' }, { id: 'b', url: 'https://example.com/b.jpg', keywords: '合影' }],
})

test('old single photo becomes an album without changing its source', () => {
  const original = { id: 'old', title: '旧照片', url: '/uploads/images/old.jpg', caption: '旧说明' }
  const normalized = preparePhotoAlbum(original)
  assert.equal(original.images, undefined)
  assert.equal(normalized.images.length, 1)
  assert.equal(normalized.description, '旧说明')
  assert.equal(normalized.url, original.url)
  assert.equal(normalized.coverImageId, normalized.images[0].id)
  assert.equal(normalizePhotoAlbum({ ...normalized, description: '' }).description, '')
})

test('chosen cover follows reordering and falls back after removing the cover', () => {
  const saved = preparePhotoAlbum(album())
  assert.equal(saved.url, 'https://example.com/b.jpg')
  assert.equal(normalizePhotoAlbum({ ...saved, images: saved.images.toReversed() }).url, saved.url)
  const removed = normalizePhotoAlbum({ ...saved, images: [saved.images[0]] })
  assert.equal(removed.coverImageId, 'a')
  assert.equal(removed.url, '/uploads/images/a.jpg')
  assert.equal(normalizePhotoAlbum({ ...saved, images: [] }).url, '')
})

test('fuzzy search spans album fields and every image; private IDs stay private', () => {
  for (const query of ['音乐', '返场', '现场', '粉丝投稿', '小林', '2026-10', '19:30', '杭州', '红裙', '侧颜', '合影', '杭州 红裙']) assert.equal(matchesPhotoAlbum(album(), query), true, query)
  assert.equal(matchesPhotoAlbum(album(), '杭州 上海'), false)
  assert.equal(matchesPhotoAlbum(album(), 'secretcc'), false)
  assert.equal(matchesPhotoAlbum(album(), 'secretcc', { includePrivate: true }), true)
  const publicItem = publicPhotoAlbum({ ...album(), changeSummary: 'internal' })
  assert.equal('fanId' in publicItem, false)
  assert.equal('changeSummary' in publicItem, false)
  assert.equal(matchesPhotoAlbum(publicPhotoAlbum({ ...album(), showFanId: true }), 'SECRETcc'), true)
  assert.equal('fanId' in publicPhotoAlbum({ ...album(), showFanId: true, authorType: 'official' }), false)
})

test('rejects malformed albums, unsafe nested URLs and invalid covers', () => {
  const changes = [{ title: ' ' }, { images: [] }, { images: null }, { images: [null] }, { images: Array(101).fill(album().images[0]) },
    { images: [album().images[0], album().images[0]] }, { images: [{ id: 'b', url: 'javascript:alert(1)' }] },
    { images: [{ id: 'b', url: 'https://user:pass@example.com/a.jpg' }] }, { images: [{ id: 'b', url: '/uploads/../secret.jpg' }] },
    { images: [{ id: 'b', url: '/uploads/images/a.jpg', keywords: {} }] }, { coverImageId: 'unknown' }, { category: 'unknown' },
    { showFanId: 'false' }, { publishedAt: '2026-02-31' }, { publishedAt: 'bad-date' }]
  for (const change of changes) assert.throws(() => preparePhotoAlbum({ ...album(), ...change }), { status: 400 })
  assert.equal(preparePhotoAlbum({ ...album(), publishedAt: '2026-10-02' }).publishedAt, '2026-10-02')
})

test('nested images and cover selection require image permissions and cannot be attached to other types', () => {
  const editor = { role: 'editor', permissions: ['text.read', 'text.write'] }
  assert.match(validateAssetChanges(null, album(), editor, 'photo'), /image.write/)
  assert.match(validateAssetChanges(null, album(), editor, 'news'), /不匹配/)
  assert.equal(validateAssetChanges(null, album(), { ...editor, permissions: ['image.read', 'image.write'] }, 'photo'), '')
})
