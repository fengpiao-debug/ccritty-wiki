// 文件作用：保存和回滚时检查图片字段权限，防止直接修改封面地址绕过上传接口的图片权限。
import { can, permissionsForUser } from '@artist-wiki/permissions'

export function validateAssetChanges(previous, payload, actor, type = '') {
  const permissions = permissionsForUser(actor)
  const canSongCover = type === 'song' && can(permissions, 'music.write')
  if (can(permissions, 'image.write')) return ''
  for (const key of ['cover', 'coverUrl', 'heroImage', 'url']) {
    if (Object.hasOwn(payload, key) && (payload[key] || '') !== (previous?.[key] || '')) {
      if (!(canSongCover && ['cover', 'coverUrl'].includes(key))) return '修改图片地址需要 image.write 权限'
    }
  }
  return ''
}
