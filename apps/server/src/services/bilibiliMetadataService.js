// 文件作用：安全地向固定 B 站官方接口解析视频元数据，并返回规范播放器信息。
import { parseBilibili } from '@artist-wiki/content-types'

const API_URL = 'https://api.bilibili.com/x/web-interface/view'
const DEFAULT_TIMEOUT_MS = 5000

export class BilibiliMetadataError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'BilibiliMetadataError'
    this.status = status
  }
}

export async function resolveBilibiliMetadata(source, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let embed
  try {
    embed = parseBilibili(source)
  } catch (error) {
    throw new BilibiliMetadataError(error.message, 400)
  }

  const requestUrl = new URL(API_URL)
  if (embed.bvid.startsWith('BV')) requestUrl.searchParams.set('bvid', embed.bvid)
  else requestUrl.searchParams.set('aid', embed.bvid.slice(2))

  let response
  try {
    response = await fetchImpl(requestUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
      headers: { Accept: 'application/json', Referer: 'https://www.bilibili.com/', 'User-Agent': 'Mozilla/5.0 ArtistWikiMetadata/1.0' },
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new BilibiliMetadataError('请求 B 站视频信息超时', 504)
    throw new BilibiliMetadataError('暂时无法连接 B 站视频信息服务', 502)
  }
  if (!response?.ok) throw new BilibiliMetadataError('B 站视频信息服务响应异常', 502)

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new BilibiliMetadataError('B 站返回了无效的视频信息', 502)
  }
  if (!payload || payload.code !== 0 || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new BilibiliMetadataError(typeof payload?.message === 'string' ? `B 站解析失败：${payload.message}` : 'B 站未返回有效的视频信息', 502)
  }

  const data = payload.data
  return {
    ...embed,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.desc === 'string' ? data.desc : '',
    cover: typeof data.pic === 'string' ? data.pic : '',
    owner: typeof data.owner?.name === 'string' ? data.owner.name : '',
  }
}
