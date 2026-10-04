// 文件作用：apps/web/src/utils/content.js，负责项目公共配置或辅助逻辑。
import { parseBilibili } from '@artist-wiki/content-types'

export function normalizeContent(payload) {
  return {
    profile: payload?.profile || {},
    news: Array.isArray(payload?.news) ? payload.news : [],
    events: Array.isArray(payload?.events) ? payload.events : [],
    photos: Array.isArray(payload?.photos) ? payload.photos : [],
    songs: Array.isArray(payload?.songs) ? payload.songs : [],
    videos: Array.isArray(payload?.videos) ? payload.videos : [],
  }
}

export function formatDate(value) {
  if (!value) return '未定'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function getVideoEmbedUrl(value) {
  try { return parseBilibili(value).embedUrl } catch { return '' }
}
