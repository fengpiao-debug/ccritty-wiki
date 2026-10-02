export const VIDEO_CATEGORIES = [
  { value: 'event', label: '现场（活动）' },
  { value: 'mv', label: '歌曲MV' },
  { value: 'vlog', label: 'vlog' },
  { value: 'live', label: '直播切片' },
  { value: 'other', label: '其他' },
]
export const videoCategoryLabel = (value) => VIDEO_CATEGORIES.find((item) => item.value === value)?.label || '其他'
export function fuzzyMatches(fields, query) {
  const text = fields.filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase()
  return String(query || '').normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).every((word) => text.includes(word))
}
export const matchesSong = (song, query) => fuzzyMatches([song.title, song.artist, song.album, String(song.lyrics || '').replace(/\[[^\]]*\]/g, '')], query)
export const matchesVideo = (video, query) => fuzzyMatches([video.title, videoCategoryLabel(video.category), video.authorName, video.publishedAt, video.publishedAt?.replace('T', ' '), video.location, video.description, video.markdown, video.keywords], query)
export function safeMvUrl(source) {
  if (typeof source !== 'string' || !source.trim()) return ''
  try {
    const url = new URL(source.trim())
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
export function validateMediaMetadata(type, value) {
  const limits = type === 'video' ? { title: 300, authorName: 300, publishedAt: 40, location: 300, description: 10000, markdown: 30000, keywords: 2000 } : { mvUrl: 2048 }
  for (const [key, limit] of Object.entries(limits)) {
    if (value[key] != null && (typeof value[key] !== 'string' || value[key].length > limit)) return key + ' 格式不正确或超过 ' + limit + ' 字符'
  }
  if (type === 'song' && value.mvUrl && !safeMvUrl(value.mvUrl)) return 'MV 链接需要是有效的 HTTP 或 HTTPS 地址'
  if (type === 'video') {
    if (value.category && !VIDEO_CATEGORIES.some((item) => item.value === value.category)) return '请选择有效的视频分类'
    if (value.publishedAt && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt)))) return '请填写有效的视频时间'
    if (value.publishedAt && new Date(value.publishedAt.slice(0, 10)).toISOString().slice(0, 10) !== value.publishedAt.slice(0, 10)) return '请填写存在的日期'
  }
  return ''
}
