// 文件作用：验证 B 站浏览器端元数据回退只接受合法视频编号，并正确映射返回字段。
import { afterEach, describe, expect, it } from 'vitest'
import { resolveBilibiliJsonp } from './bilibiliJsonp'

afterEach(() => { document.head.querySelectorAll('script[src*="api.bilibili.com/x/web-interface/view"]').forEach((script) => script.remove()) })

describe('B 站浏览器端元数据回退', () => {
  it('通过固定 JSONP 接口读取视频标题、简介、封面和作者', async () => {
    const resultPromise = resolveBilibiliJsonp('BV1xx411c7mD')
    const script = document.head.querySelector('script[src*="api.bilibili.com/x/web-interface/view"]')
    const requestUrl = new URL(script.src)
    const callback = requestUrl.searchParams.get('callback')
    expect(requestUrl.searchParams.get('bvid')).toBe('BV1xx411c7mD')
    globalThis[callback]({ code: 0, data: { title: '视频标题', desc: '视频简介', pic: 'http://i2.hdslb.com/cover.jpg', owner: { name: '作者' } } })
    await expect(resultPromise).resolves.toMatchObject({
      bvid: 'BV1xx411c7mD', title: '视频标题', description: '视频简介', cover: 'https://i2.hdslb.com/cover.jpg', owner: '作者',
    })
    expect(script.isConnected).toBe(false)
  })

  it('拒绝外站地址且不插入远程脚本', () => {
    expect(() => resolveBilibiliJsonp('https://evil.example/video')).toThrow('只允许 B 站')
    expect(document.head.querySelector('script[src*="api.bilibili.com/x/web-interface/view"]')).toBeNull()
  })
})
