// 对真实内容服务替换存储依赖，验证版本迁移而不连接本地数据库。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const storeUrl = moduleUrl([
  'export let state = { content: { photos: [] }, versions: [] };',
  'export let persisted = null;',
  'export const cloneState = (value) => JSON.parse(JSON.stringify(value));',
  'export const getState = () => state;',
  'export const nextId = (prefix) => prefix + state.versions.length;',
  'export const persist = async () => { persisted = cloneState(state); };',
  'export const reload = () => { state = cloneState(persisted); };',
].join('\n'))
const memory = await import(storeUrl)
const serviceSource = (await readFile(new URL('./contentService.js', import.meta.url), 'utf8'))
  .replace("from '../store.js'", 'from ' + JSON.stringify(storeUrl))
  .replace("from '@artist-wiki/content-types'", 'from ' + JSON.stringify(import.meta.resolve('@artist-wiki/content-types')))
const { saveItem, getItem, listVersions, restoreItem } = await import(moduleUrl(serviceSource))
const actor = { username: 'test-editor' }

test('restoring songs and videos replaces fields absent from the old snapshot and survives reload', async () => {
  for (const [type, collection] of [['song', 'songs'], ['video', 'videos']]) {
    memory.state.content[collection] = []
    const original = await saveItem(type, 'rollback-' + type, { title: '原始内容' }, actor)
    const version = listVersions(type, original.id)[0]
    await saveItem(type, original.id, { mvUrl: 'https://example.com/mv', description: '后加说明', authorName: '新作者', keywords: '新关键词', cover: '/uploads/images/new.jpg' }, actor)
    await restoreItem(type, original.id, version.id, actor)
    memory.reload()
    const restored = getItem(type, original.id)
    assert.equal(restored.title, '原始内容')
    assert.equal(restored.createdAt, original.createdAt)
    for (const key of ['mvUrl', 'description', 'authorName', 'keywords', 'cover']) assert.equal(Object.hasOwn(restored, key), false)
    assert.equal(restored.deletedAt, null)
  }
})

test('save/reload retains album metadata; restoring a legacy snapshot removes later images and private fields', async () => {
  memory.state.content.photos = [{ id: 'old', type: 'photo', title: '旧照片', url: '/uploads/images/old.jpg', caption: '原始说明' }]
  const saved = await saveItem('photo', 'old', { title: '新图集', category: 'portrait', authorType: 'fan', authorName: '小林', fanId: 'private', showFanId: true, publishedAt: '2026-10-02T19:30', location: '杭州', coverImageId: 'second', images: [
    { id: 'first', url: '/uploads/images/first.jpg', keywords: '舞台' },
    { id: 'second', url: '/uploads/images/second.jpg', keywords: '红裙', description: '返场' },
  ] }, actor)
  assert.equal(saved.url, '/uploads/images/second.jpg')
  memory.reload()
  assert.equal(getItem('photo', 'old').images[1].keywords, '红裙')
  assert.equal(getItem('photo', 'old').location, '杭州')
  assert.equal(listVersions('photo', 'old').length, 2)
  const initial = memory.state.versions.find((item) => item.changeSummary === '初始版本')
  await restoreItem('photo', 'old', initial.id, actor)
  memory.reload()
  const restored = getItem('photo', 'old')
  assert.equal(restored.title, '旧照片')
  assert.equal(restored.images.length, 1)
  assert.equal(restored.url, '/uploads/images/old.jpg')
  assert.equal(restored.description, '原始说明')
  assert.equal(restored.fanId, '')
  assert.equal(restored.showFanId, false)
  assert.equal(listVersions('photo', 'old').length, 3)
})
