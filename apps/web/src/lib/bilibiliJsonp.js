// 文件作用：在服务端访问 B 站受限时，用固定地址的 JSONP 请求从当前浏览器获取公开视频元数据。
import { parseBilibili } from '@artist-wiki/content-types'

export function resolveBilibiliJsonp(source, { timeoutMs = 8000 } = {}) {
  const embed = parseBilibili(source)
  const callbackId = globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now()}${Math.random().toString(16).slice(2)}`
  const callbackName = `__artistWikiBili_${callbackId}`
  const url = new URL('https://api.bilibili.com/x/web-interface/view')
  url.searchParams.set(embed.bvid.startsWith('BV') ? 'bvid' : 'aid', embed.bvid.startsWith('BV') ? embed.bvid : embed.bvid.slice(2))
  url.searchParams.set('jsonp', 'jsonp')
  url.searchParams.set('callback', callbackName)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    const cleanup = () => {
      clearTimeout(timer)
      delete globalThis[callbackName]
      script.remove()
    }
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    const timer = setTimeout(() => finish(reject, new Error('浏览器请求 B 站信息超时')), timeoutMs)

    globalThis[callbackName] = (payload) => {
      if (payload?.code !== 0 || !payload.data || typeof payload.data !== 'object') {
        finish(reject, new Error(payload?.message || 'B 站未返回有效视频信息'))
        return
      }
      const data = payload.data
      finish(resolve, {
        ...embed,
        title: typeof data.title === 'string' ? data.title : '',
        description: typeof data.desc === 'string' ? data.desc : '',
        cover: typeof data.pic === 'string' ? data.pic.replace(/^http:\/\//i, 'https://') : '',
        owner: typeof data.owner?.name === 'string' ? data.owner.name : '',
      })
    }
    script.onerror = () => finish(reject, new Error('浏览器无法加载 B 站视频信息'))
    script.onload = () => {
      if (!settled) finish(reject, new Error('B 站没有返回可解析的视频详情'))
    }
    script.src = url.toString()
    document.head.append(script)
  })
}
