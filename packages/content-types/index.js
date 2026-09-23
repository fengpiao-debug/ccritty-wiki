// 文件作用：packages/content-types/index.js，负责项目公共配置或辅助逻辑。
export { UPLOAD_TYPES, validateUploadMetadata } from './uploads.js'
export { parseBilibili } from './video.js'
export const CONTENT_TYPES = ['profile', 'news', 'event', 'photo', 'song', 'video']

export const CONTENT_LABELS = {
  profile: '歌手简介',
  news: '动态',
  event: '未来活动',
  photo: '照片',
  song: '歌曲',
  video: '视频',
}

export function createId(prefix, cryptoApi = globalThis.crypto) {
  return `${prefix}-${createUuid(cryptoApi)}`
}

function createUuid(cryptoApi) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
