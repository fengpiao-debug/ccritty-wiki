// 文件作用：保存和回滚时检查图片字段权限，防止直接修改封面地址绕过上传接口的图片权限。
import { canWriteImage, permissionsForUser } from '@artist-wiki/permissions'

export function validateAssetChanges(previous, payload, actor, type = '') {
  const permissions = permissionsForUser(actor)
  const allowedFields = {
    profile: ['heroImage'],
    news: ['cover'],
    event: ['cover'],
    photo: ['url', 'images', 'coverImageId'],
    song: ['cover'],
    video: ['cover'],
  }[type] || []
  for (const key of ['cover', 'coverUrl', 'heroImage', 'url', 'images', 'coverImageId']) {
    if (Object.hasOwn(payload, key) && JSON.stringify(payload[key] || '') !== JSON.stringify(previous?.[key] || '')) {
      if (!allowedFields.includes(key)) return '图片字段与内容类型不匹配'
      if (canWriteImage(permissions, type)) continue
      return type === 'song'
        ? '修改歌曲封面需要 image.song.write 权限'
        : type === 'video' ? '修改视频封面需要 image.video.write 权限' : '修改图片地址需要 image.write 权限'
    }
  }
  return ''
}
