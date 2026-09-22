// 文件作用：apps/server/src/middleware/permissions.js，负责后端服务的独立功能模块。
import { CONTENT_PERMISSION, can, permissionsForUser } from '@artist-wiki/permissions'
import { getState } from '../store.js'

export function hydrateUser(request, _response, next) {
  const user = getState().users.find((user) => user.id === request.user.sub)
  if (!user) return _response.status(401).json({ message: '用户不存在' })
  request.actor = { ...user, permissions: permissionsForUser(user) }
  next()
}

export function requirePermission(permission) {
  return (request, response, next) => {
    if (!can(permissionsForUser(request.actor), permission)) return response.status(403).json({ message: `缺少权限：${permission}` })
    next()
  }
}

export function requireContentWrite(request, response, next) {
  const scope = CONTENT_PERMISSION[request.params.type]
  if (!scope || !can(permissionsForUser(request.actor), `${scope}.write`)) return response.status(403).json({ message: '没有编辑该内容的权限' })
  next()
}

export function requireContentRead(request, response, next) {
  const scope = CONTENT_PERMISSION[request.params.type]
  if (!scope || !can(permissionsForUser(request.actor), `${scope}.read`)) return response.status(403).json({ message: '没有查看该内容的权限' })
  next()
}
