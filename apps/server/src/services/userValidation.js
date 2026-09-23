// 文件作用：校验账号创建和权限调整，只允许为编辑者分配已知内容权限，防止越权授权。
import { PERMISSIONS } from '@artist-wiki/permissions'

export function validateUserInput(body, creating = false) {
  if (creating && (typeof body.username !== 'string' || !/^[\w-]{3,80}$/.test(body.username))) return '账号须为 3 至 80 位字母、数字、下划线或短横线'
  if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.trim().length > 120) return '请填写 1 至 120 字的显示名称'
  if (creating || body.password) {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 200) return '密码长度须为 8 至 200 位'
  }
  if (!Array.isArray(body.permissions) || body.permissions.some((permission) => !PERMISSIONS.includes(permission) || permission === 'user.manage')) return '只能分配已知的内容权限'
  for (const scope of ['text', 'image', 'image.song', 'image.video', 'music', 'video']) {
    if (body.permissions.includes(`${scope}.write`) && !body.permissions.includes(`${scope}.read`)) return '编辑权限必须同时包含查看权限'
  }
  return ''
}
