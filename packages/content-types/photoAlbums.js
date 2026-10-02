// 前后台共用图集格式；读取旧单图时兼容转换，不修改原始记录。
export const PHOTO_CATEGORIES = [
  { value: 'event', label: '现场（活动）' },
  { value: 'portrait', label: '写真（CC发布的）' },
  { value: 'life', label: '生活照（CC发布的）' },
  { value: 'other', label: '其他' },
]
export const PHOTO_AUTHOR_TYPES = [
  { value: 'official', label: '官摄' },
  { value: 'fan', label: '粉丝投稿' },
  { value: 'photographer', label: '摄影师' },
  { value: 'other', label: '其他' },
]
export const MAX_ALBUM_IMAGES = 100
const text = (value) => typeof value === 'string' ? value : ''

export function normalizePhotoAlbum(record = {}) {
  const images = Array.isArray(record.images) ? record.images.map((item) => ({
    id: text(item?.id), url: text(item?.url), keywords: text(item?.keywords), description: text(item?.description),
  })) : record.url ? [{ id: `${record.id || 'legacy'}-image`, url: text(record.url), keywords: '', description: text(record.caption) }] : []
  const coverImageId = images.some((item) => item.id === record.coverImageId) ? record.coverImageId : images[0]?.id || ''
  return {
    ...record, title: text(record.title), description: text(Object.hasOwn(record, 'description') ? record.description : record.caption),
    category: PHOTO_CATEGORIES.some((item) => item.value === record.category) ? record.category : 'other',
    authorType: PHOTO_AUTHOR_TYPES.some((item) => item.value === record.authorType) ? record.authorType : 'other',
    authorName: text(record.authorName), fanId: text(record.fanId), showFanId: record.showFanId === true,
    publishedAt: text(record.publishedAt), location: text(record.location), images, coverImageId,
    url: images.find((item) => item.id === coverImageId)?.url || '',
  }
}

export function validatePhotoAlbum(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return '图集格式不正确'
  const limits = { title: 200, description: 10000, authorName: 200, fanId: 100, location: 300, publishedAt: 40 }
  for (const [key, limit] of Object.entries(limits)) {
    if (record[key] != null && (typeof record[key] !== 'string' || record[key].length > limit)) return `图集字段 ${key} 格式不正确或超过 ${limit} 字符`
  }
  if (!record.title?.trim()) return '请填写图集标题'
  if (record.category != null && !PHOTO_CATEGORIES.some((item) => item.value === record.category)) return '请选择有效的大分类'
  if (record.authorType != null && !PHOTO_AUTHOR_TYPES.some((item) => item.value === record.authorType)) return '请选择有效的作者类型'
  if (record.showFanId != null && typeof record.showFanId !== 'boolean') return '粉丝 ID 展示开关格式不正确'
  if (record.publishedAt && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(record.publishedAt) || !Number.isFinite(Date.parse(record.publishedAt)))) return '请填写有效的拍摄 / 发布时间'
  if (record.publishedAt && new Date(record.publishedAt.slice(0, 10)).toISOString().slice(0, 10) !== record.publishedAt.slice(0, 10)) return '请填写存在的日期'
  if (Object.hasOwn(record, 'images') && !Array.isArray(record.images)) return '图集图片格式不正确'
  const album = normalizePhotoAlbum(record)
  if (!album.images.length) return '请至少添加一张图片'
  if (album.images.length > MAX_ALBUM_IMAGES) return `每个图集最多 ${MAX_ALBUM_IMAGES} 张图片`
  const ids = new Set()
  for (const [index, image] of album.images.entries()) {
    const original = record.images?.[index] || image
    if (!image.id || image.id.length > 150 || ids.has(image.id)) return '图片编号不能为空或重复'
    ids.add(image.id)
    if (!image.url.trim() || image.url.length > 2048) return `第 ${index + 1} 张图片地址不能为空或过长`
    for (const key of ['keywords', 'description']) {
      if (original[key] != null && (typeof original[key] !== 'string' || original[key].length > 2000)) return `第 ${index + 1} 张图片的关键词或描述格式不正确（最多 2000 字符）`
    }
  }
  if (record.coverImageId && !ids.has(record.coverImageId)) return '封面必须是图集中的一张图片'
  return ''
}

export function photoCategoryLabel(value) {
  return PHOTO_CATEGORIES.find((item) => item.value === value)?.label || '其他'
}
export function photoAuthorLabel(album) {
  return [PHOTO_AUTHOR_TYPES.find((item) => item.value === album.authorType)?.label, album.authorName, album.authorType === 'fan' && album.showFanId ? album.fanId : ''].filter(Boolean).join(' · ')
}

export function matchesPhotoAlbum(record, query, { includePrivate = false } = {}) {
  const album = normalizePhotoAlbum(record)
  const haystack = [album.title, album.description, photoCategoryLabel(album.category), photoAuthorLabel(album),
    includePrivate ? album.fanId : '', album.publishedAt, album.publishedAt.replace('T', ' '), album.location,
    ...album.images.flatMap((item) => [item.keywords, item.description]),
  ].join(' ').normalize('NFKC').toLocaleLowerCase()
  return String(query).normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).every((word) => haystack.includes(word))
}

export function publicPhotoAlbum(record) {
  const album = normalizePhotoAlbum(record)
  // 使用公开字段白名单，内部备注和未授权公开的粉丝 ID 不发送给访客。
  return Object.fromEntries(['id', 'title', 'description', 'category', 'authorType', 'authorName', 'publishedAt', 'location', 'images', 'coverImageId', 'url', 'createdAt', 'updatedAt', 'showFanId',
    ...(album.authorType === 'fan' && album.showFanId ? ['fanId'] : []),
  ].map((key) => [key, album[key]]))
}
