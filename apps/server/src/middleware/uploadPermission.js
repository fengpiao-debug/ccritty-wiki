// 文件作用：在读取 multipart 文件前验证资源分类及领域权限，阻止只读、跨领域和管理员上传。
import { UPLOAD_TYPES } from '@artist-wiki/content-types'
import { can, permissionsForUser } from '@artist-wiki/permissions'

export function requireUploadPermission(request, response, next) {
  const rule = Object.hasOwn(UPLOAD_TYPES, request.query.category) ? UPLOAD_TYPES[request.query.category] : null
  if (!rule) return response.status(400).json({ message: '不支持的上传分类' })
  if (!can(permissionsForUser(request.actor), rule.permission)) return response.status(403).json({ message: `缺少上传权限：${rule.permission}` })
  next()
}
