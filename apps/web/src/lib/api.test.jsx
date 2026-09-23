// 文件作用：验证视频元数据优先走权限 API，并在云端上游受限时回退到浏览器请求。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentApi } from './api'

const response = (status, payload) => ({ ok: status >= 200 && status < 300, status, json: async () => payload })

beforeEach(() => localStorage.setItem('artist-wiki-token', 'test-token'))
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  document.head.querySelectorAll('script[src*="api.bilibili.com/x/web-interface/view"]').forEach((script) => script.remove())
})

describe('视频元数据 API', () => {
  it('服务端因网络限制失败时，回退为浏览器 JSONP 请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(502, { message: '暂时无法连接 B 站视频信息服务' }))
    vi.stubGlobal('fetch', fetchMock)
    const resultPromise = contentApi.resolveVideo('BV1xx411c7mD')
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/videos/resolve', expect.objectContaining({ method: 'POST' }))
    await vi.waitFor(() => expect(document.head.querySelector('script[src*="api.bilibili.com/x/web-interface/view"]')).not.toBeNull())
    const script = document.head.querySelector('script[src*="api.bilibili.com/x/web-interface/view"]')
    const callback = new URL(script.src).searchParams.get('callback')
    globalThis[callback]({ code: 0, data: { title: '浏览器获取标题', desc: '简介', pic: 'https://i2.hdslb.com/cover.jpg' } })
    await expect(resultPromise).resolves.toMatchObject({ title: '浏览器获取标题', description: '简介' })
  })

  it('权限错误不会触发 B 站 JSONP 请求', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(403, { message: '缺少视频权限' })))
    await expect(contentApi.resolveVideo('BV1xx411c7mD')).rejects.toThrow('缺少视频权限')
    expect(document.head.querySelector('script[src*="api.bilibili.com/x/web-interface/view"]')).toBeNull()
  })
})
