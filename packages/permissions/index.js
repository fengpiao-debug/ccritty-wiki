// 文件作用：packages/permissions/index.js，负责项目公共配置或辅助逻辑。
export const PERMISSIONS = [
  'text.read',
  'text.write',
  'image.read',
  'image.write',
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

// 管理身份与内容身份互斥；即使历史记录残留 * 或内容权限，管理员也只能管理账号。
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
