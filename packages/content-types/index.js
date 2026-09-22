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

export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}
