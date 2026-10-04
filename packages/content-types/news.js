// 动态标识与多标签独立存储；常用文案仅作建议，允许自定义。
export const NEWS_KIND_SUGGESTIONS = ['新歌发布', 'MV发布', '专辑发布', '演出资讯', '直播预告', '日常分享']
export const MAX_NEWS_KIND_LENGTH = 20

export function normalizeNewsKind(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateNewsKind(value) {
  if (value == null) return ''
  if (typeof value !== 'string') return '动态标识必须是文字'
  if (normalizeNewsKind(value).length > MAX_NEWS_KIND_LENGTH) return `动态标识最多 ${MAX_NEWS_KIND_LENGTH} 个字符`
  return ''
}
