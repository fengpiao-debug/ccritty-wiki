// 文件作用：packages/permissions/index.js，负责项目公共配置或辅助逻辑。
export const PERMISSIONS = [
  'text.read',
  'text.write',
  'image.read',
  'image.write',
  'image.song.read',
  'image.song.write',
  'image.video.read',
  'image.video.write',
  'music.read',
  'music.write',
  'video.read',
  'video.write',
  'content.publish',
  'content.rollback',
  'user.manage',
]

export const CONTENT_PERMISSION = {
  profile: 'text',
  news: 'text',
  event: 'text',
  photo: 'image',
  song: 'music',
  video: 'video',
}

export function can(permissions = [], permission) {
  return permissions.includes(permission)
}

// 管理身份与内容身份互斥；管理员仅管理账号及网站设置，不拥有歌手内容编辑权限。
export function permissionsForUser(user) {
  if (!user) return []
  if (user.role === 'admin') return ['user.manage']
  return (user.permissions || []).filter((permission) => PERMISSIONS.includes(permission) && permission !== 'user.manage')
}

export function canReadContent(permissions, type) {
  const scope = CONTENT_PERMISSION[type]
  return can(permissions, `${scope}.read`)
}

export function canWriteContent(permissions, type) {
  const scope = CONTENT_PERMISSION[type]
  return can(permissions, `${scope}.write`)
}

// 根据图片所属内容返回最小图片权限；通用图片权限仍覆盖非歌曲/视频图片。
export function imagePermissionForType(type, action = 'read') {
  if (type === 'song') return `image.song.${action}`
  if (type === 'video') return `image.video.${action}`
  return `image.${action}`
}

export function canReadImage(permissions, type) {
  return can(permissions, imagePermissionForType(type, 'read')) || can(permissions, 'image.read')
}

export function canWriteImage(permissions, type) {
  return can(permissions, imagePermissionForType(type, 'write')) || can(permissions, 'image.write')
}
