// 文件作用：列出可维护的图片位置，并在独立图片权限下安全更新内容图片字段。
import { audit, getState, persist } from '../store.js'
import { getItem, listContent, saveItem } from './contentService.js'
import { canReadImage, canWriteImage, permissionsForUser } from '@artist-wiki/permissions'

const imageSlots = {
  profile: { collection: 'profile', field: 'heroImage', label: '歌手简介' },
  news: { collection: 'news', field: 'cover', label: '动态' },
  event: { collection: 'events', field: 'cover', label: '活动' },
  photo: { collection: 'photos', field: 'url', label: '照片' },
  song: { collection: 'songs', field: 'cover', label: '歌曲' },
  video: { collection: 'videos', field: 'cover', label: '视频' },
}

export function validateImageAssetUrl(source) {
  const value = String(source ?? '').trim()
  if (!value) return ''
  if (value.length > 2048) return '图片地址不能超过 2048 个字符'
  if (/^\/uploads\/images\/[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value)) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '图片地址必须是安全的 HTTP 或 HTTPS 地址'
    return ''
  } catch {
    return '请输入有效的图片地址或先上传图片'
  }
}

export function listImageAssets(actor) {
  const permissions = permissionsForUser(actor)
  if (!['profile', 'news', 'event', 'photo', 'song', 'video'].some((type) => canReadImage(permissions, type))) return null
  const content = listContent()
  const items = []
  for (const [type, slot] of Object.entries(imageSlots)) {
    if (!canReadImage(permissions, type)) continue
    const records = slot.collection === 'profile' ? [content.profile] : content[slot.collection]
    for (const record of records || []) {
      if (!record || record.deletedAt) continue
      items.push({
        type,
        id: record.id,
        title: record.title || record.artistName || record.id,
        field: slot.field,
        label: slot.label,
        album: type === 'photo' && Array.isArray(record.images),
        imageCount: type === 'photo' ? record.images?.length || (record.url ? 1 : 0) : undefined,
        url: record[slot.field] || '',
      })
    }
  }
  return { items }
}

export async function updateImageAsset(type, id, source, actor) {
  const slot = imageSlots[type]
  if (!slot) return { status: 400, message: '不支持的图片内容类型' }
  if (!canWriteImage(permissionsForUser(actor), type)) return { status: 403, message: type === 'song' ? '缺少歌曲封面图片写入权限' : type === 'video' ? '缺少视频封面图片写入权限' : '缺少图片写入权限' }
  const invalid = validateImageAssetUrl(source)
  if (invalid) return { status: 400, message: invalid }
  const content = listContent()
  const item = type === 'profile'
    ? (content.profile?.id === id ? content.profile : null)
    : getItem(type, id)
  if (!item || item.deletedAt) return { status: 404, message: '图片所属内容不存在' }
  if (type === 'photo' && Array.isArray(item.images)) return { status: 400, message: '请在图集管理中修改图片或选择封面' }

  const now = Date.now()
  getState().locks = getState().locks.filter((lock) => new Date(lock.expiresAt).getTime() > now)
  const occupied = getState().locks.find((lock) => lock.type === type && lock.contentId === id)
  if (occupied) return { status: 423, message: `内容正在被 ${occupied.username} 编辑` }

  const lock = {
    type,
    contentId: id,
    userId: actor.id,
    username: actor.username,
    expiresAt: new Date(now + 2 * 60 * 1000).toISOString(),
  }
  getState().locks.push(lock)
  try {
    await persist()
    const updated = await saveItem(type, id, { [slot.field]: String(source ?? '').trim() }, actor, '更新图片资源')
    await audit({
      actor: actor.username,
      action: 'image.update',
      target: type,
      targetId: id,
      metadata: { title: item.title || item.artistName || id, field: slot.field },
    })
    return { item: updated }
  } catch (error) {
    return { status: 500, message: '图片保存失败' }
  } finally {
    getState().locks = getState().locks.filter((entry) => entry.userId !== actor.id || entry.type !== type || entry.contentId !== id)
    await persist()
  }
}
