// 文件作用：验证 B 站元数据解析只访问固定官方接口，并正确处理输入、超时和异常响应。
import test from 'node:test'
import assert from 'node:assert/strict'
import { BilibiliMetadataError, resolveBilibiliMetadata } from './bilibiliMetadataService.js'

const bvid = 'BV1xx411c7mD'

test('normalizes allowlisted video input and returns metadata from the fixed API', async () => {
  let requestedUrl
  let requestOptions
  const result = await resolveBilibiliMetadata(`https://www.bilibili.com/video/${bvid}/?spm_id_from=unsafe`, {
    fetchImpl: async (url, options) => {
      requestedUrl = url
      requestOptions = options
      return { ok: true, json: async () => ({ code: 0, data: { title: '视频标题', desc: '简介', pic: 'https://i.example/cover.jpg', owner: { name: '作者' } } }) }
    },
  })
  assert.equal(requestedUrl.origin + requestedUrl.pathname, 'https://api.bilibili.com/x/web-interface/view')
  assert.equal(requestedUrl.searchParams.get('bvid'), bvid)
  assert.equal(requestedUrl.searchParams.has('spm_id_from'), false)
  assert.equal(requestOptions.signal instanceof AbortSignal, true)
  assert.equal(result.embedUrl.startsWith('https://player.bilibili.com/player.html?'), true)
  assert.deepEqual({ title: result.title, description: result.description, cover: result.cover, owner: result.owner }, {
    title: '视频标题', description: '简介', cover: 'https://i.example/cover.jpg', owner: '作者',
  })
})

test('uses aid for allowlisted AV identifiers', async () => {
  let requestedUrl
  await resolveBilibiliMetadata('av123', {
    fetchImpl: async (url) => { requestedUrl = url; return { ok: true, json: async () => ({ code: 0, data: {} }) } },
  })
  assert.equal(requestedUrl.searchParams.get('aid'), '123')
  assert.equal(requestedUrl.searchParams.has('bvid'), false)
})

test('rejects unallowlisted sources before making a request', async () => {
  let called = false
  await assert.rejects(resolveBilibiliMetadata('https://attacker.example/video', { fetchImpl: async () => { called = true } }), (error) => error.status === 400)
  assert.equal(called, false)
})

test('maps timeout, transport, HTTP, and API payload failures to controlled errors', async (t) => {
  const cases = [
    ['timeout', async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error }, 504],
    ['transport', async () => { throw new Error('network') }, 502],
    ['http', async () => ({ ok: false, json: async () => ({}) }), 502],
    ['api', async () => ({ ok: true, json: async () => ({ code: -404, message: 'not found' }) }), 502],
    ['invalid json', async () => ({ ok: true, json: async () => { throw new Error('bad json') } }), 502],
  ]
  for (const [name, fetchImpl, status] of cases) await t.test(name, async () => {
    await assert.rejects(resolveBilibiliMetadata(bvid, { fetchImpl }), (error) => error instanceof BilibiliMetadataError && error.status === status)
  })
})
