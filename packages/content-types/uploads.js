// 文件作用：前后端共用上传分类、权限、格式和大小限制；客户端预检不能替代服务端内容校验。
const MB = 1024 * 1024
export const UPLOAD_TYPES = {
  siteIcon: { permission: 'user.manage', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], maxSize: 5 * MB, label: '网站图标', hint: 'PNG / JPG / WEBP / GIF / AVIF · 最大 5MB · 自动生成 PNG 图标' },
  siteLogo: { permission: 'user.manage', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], maxSize: 5 * MB, label: '网站标识', hint: 'PNG / JPG / WEBP / GIF / AVIF · 最大 5MB · 建议使用正方形图片' },
  image: { permission: 'image.write', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], maxSize: 25 * MB, label: '图片', hint: 'JPG / PNG / WEBP / GIF / AVIF · 最大 25MB' },
  cover: { permission: 'image.song.write', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], maxSize: 25 * MB, label: '歌曲封面', hint: 'JPG / PNG / WEBP / GIF / AVIF · 最大 25MB' },
  videoCover: { permission: 'image.video.write', extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], maxSize: 25 * MB, label: '视频封面', hint: 'JPG / PNG / WEBP / GIF / AVIF · 最大 25MB' },
  audio: { permission: 'music.write', extensions: ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'], maxSize: 25 * MB, label: '音频', hint: 'MP3 / M4A / WAV / OGG / FLAC / AAC · 最大 25MB' },
  text: { permission: 'text.write', extensions: ['.md', '.txt'], maxSize: MB, label: '正文', hint: 'UTF-8 · MD / TXT · 最大 1MB' },
  lyrics: { permission: 'music.write', extensions: ['.lrc', '.txt'], maxSize: MB, label: '歌词', hint: 'UTF-8 · LRC / TXT · 最大 1MB' },
  video: { permission: 'video.write', extensions: ['.txt'], maxSize: MB, label: 'B站信息', hint: 'BV / AV / B站链接 / iframe · TXT 最大 1MB' },
}

export function validateUploadMetadata(file, category) {
  const rule = Object.hasOwn(UPLOAD_TYPES, category) ? UPLOAD_TYPES[category] : null
  if (!rule) return '不支持的上传分类'
  const name = String(file.name || '')
  if (!name || name.length > 128 || name !== name.trim() || /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)) return '文件名包含不允许的字符'
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || name.slice(0, dot).includes('.') || !rule.extensions.includes(name.slice(dot).toLowerCase())) return '文件扩展名不受支持，禁止使用双重扩展名'
  if (!Number.isFinite(file.size) || file.size <= 0) return '文件为空'
  if (file.size > rule.maxSize) return `文件超过 ${rule.maxSize / MB}MB 限制`
  return ''
}
