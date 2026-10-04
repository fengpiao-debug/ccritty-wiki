// 对真实内容服务替换存储依赖，验证版本迁移而不连接本地数据库。
import test, { beforeEach } from 'node:test'
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
beforeEach(() => { memory.state.content = { photos: [] }; memory.state.versions = [] })

test('legacy event categories migrate on partial edits, can be cleared and restored from old snapshots', async () => {
  memory.state.content.events = [{ id: 'legacy', type: 'event', title: '旧活动', category: '拼盘演出', tags: [] }]
  await saveItem('event', 'legacy', { cover: '/uploads/images/cover.jpg' }, actor)
  memory.reload()
  assert.deepEqual(getItem('event', 'legacy').tags, ['拼盘演出'])
  assert.equal(Object.hasOwn(getItem('event', 'legacy'), 'category'), false)
  const initial = memory.state.versions.find((item) => item.changeSummary === '初始版本')
  await saveItem('event', 'legacy', { tags: ['拼盘演出', '南京', '国风'] }, actor)
  memory.reload()
  assert.deepEqual(getItem('event', 'legacy').tags, ['拼盘演出', '南京', '国风'])
  await restoreItem('event', 'legacy', initial.id, actor)
  memory.reload()
  assert.deepEqual(getItem('event', 'legacy').tags, ['拼盘演出'])
  assert.equal(Object.hasOwn(getItem('event', 'legacy'), 'category'), false)
  await saveItem('event', 'legacy', { tags: [] }, actor)
  await saveItem('event', 'legacy', { title: '全部清空后再次编辑' }, actor)
  memory.reload()
  assert.deepEqual(getItem('event', 'legacy').tags, [])
})

test('explicit tags replace legacy categories and clearing cannot resurrect a category', async () => {
  for (const tags of [[], ['国风', '南京']]) {
    memory.state.content.events = [{ id: 'legacy', type: 'event', category: '拼盘演出', tags: ['现场'] }]
    await saveItem('event', 'legacy', { tags }, actor)
    memory.reload()
    assert.deepEqual(getItem('event', 'legacy').tags, tags)
    assert.equal(Object.hasOwn(getItem('event', 'legacy'), 'category'), false)
    await saveItem('event', 'legacy', { title: '继续编辑' }, actor)
    assert.deepEqual(getItem('event', 'legacy').tags, tags)
  }
})

test('news and event tags survive save/reload, partial edits and restoring tagged or legacy versions', async () => {
  for (const [type, collection] of [['news', 'news'], ['event', 'events']]) {
    memory.state.content[collection] = [{ id: type + '-tags', type, title: '旧内容' }]
    const id = type + '-tags'
    await saveItem(type, id, { tags: '音乐会， 南京、音乐会;现场' }, actor)
    memory.reload()
    assert.deepEqual(getItem(type, id).tags, ['音乐会', '南京', '现场'])
    const tagged = memory.state.versions.find((version) => version.contentId === id && version.snapshot.tags?.length)
    const legacy = memory.state.versions.find((version) => version.contentId === id && !version.snapshot.tags)
    await saveItem(type, id, { title: '只改标题' }, actor)
    assert.deepEqual(getItem(type, id).tags, ['音乐会', '南京', '现场'])
    await saveItem(type, id, { tags: [] }, actor)
    memory.reload()
    assert.deepEqual(getItem(type, id).tags, [])
    await restoreItem(type, id, tagged.id, actor)
    memory.reload()
    assert.deepEqual(getItem(type, id).tags, ['音乐会', '南京', '现场'])
    await restoreItem(type, id, legacy.id, actor)
    memory.reload()
    assert.deepEqual(getItem(type, id).tags, [])
    assert.equal(getItem(type, id).title, '旧内容')
  }
})

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
