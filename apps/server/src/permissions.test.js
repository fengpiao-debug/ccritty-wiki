// 文件作用：apps/server/src/permissions.test.js，负责后端服务的独立功能模块。
import test from 'node:test'
import assert from 'node:assert/strict'
import { can, canReadContent, canWriteContent, permissionsForUser } from '@artist-wiki/permissions'
import { requireContentRead, requireContentWrite, requirePermission } from './middleware/permissions.js'
import { validateUserInput } from './services/userValidation.js'

test('editor permissions are scoped to their assigned content domain', () => {
  const permissions = ['text.read', 'text.write']
  assert.equal(canReadContent(permissions, 'news'), true)
  assert.equal(canWriteContent(permissions, 'news'), true)
  assert.equal(canWriteContent(permissions, 'song'), false)
  assert.equal(can(permissions, 'user.manage'), false)
})

test('administrator has only account management even with legacy wildcard permissions', () => {
  const permissions = permissionsForUser({ role: 'admin', permissions: ['*', 'text.write', 'content.rollback'] })
  assert.deepEqual(permissions, ['user.manage'])
  assert.equal(can(permissions, 'user.manage'), true)
  assert.equal(canWriteContent(permissions, 'video'), false)
  assert.equal(can(['*'], 'text.write'), false)
})

test('editors cannot inherit account management from stored permissions', () => {
  assert.deepEqual(permissionsForUser({ role: 'editor', permissions: ['*', 'user.manage', 'text.read'] }), ['text.read'])
})

function invoke(middleware, actor, type = 'news') {
  let status = 200
  let passed = false
  const response = { status(code) { status = code; return this }, json() {} }
  middleware({ actor, params: { type } }, response, () => { passed = true })
  return { status, passed }
}

test('server middleware denies administrator content reads, writes and rollback', () => {
  const admin = { role: 'admin', permissions: ['*', 'text.read', 'text.write', 'content.rollback'] }
  for (const middleware of [requireContentRead, requireContentWrite, requirePermission('content.rollback')]) {
    assert.deepEqual(invoke(middleware, admin), { status: 403, passed: false })
  }
  assert.equal(invoke(requirePermission('user.manage'), admin).passed, true)
})

test('server middleware scopes editor writes and rejects account management', () => {
  const editor = { role: 'editor', permissions: ['text.read', 'text.write', 'user.manage'] }
  assert.equal(invoke(requireContentWrite, editor, 'news').passed, true)
  assert.equal(invoke(requireContentWrite, editor, 'song').status, 403)
  assert.equal(invoke(requireContentRead, editor, 'song').status, 403)
  assert.equal(invoke(requirePermission('user.manage'), editor).status, 403)
})

test('user input rejects wildcard, role-management grants, unknown scopes and weak passwords', () => {
  const valid = { username: 'editor-a', displayName: '文字编辑', password: 'a-strong-password', permissions: ['text.read', 'text.write'] }
  assert.equal(validateUserInput(valid, true), '')
  for (const permissions of [['*'], ['user.manage'], ['unknown.read'], ['text.write']]) {
    assert.notEqual(validateUserInput({ ...valid, permissions }, true), '')
  }
  assert.notEqual(validateUserInput({ ...valid, password: 'short' }, true), '')
  assert.notEqual(validateUserInput({ ...valid, username: 'a b' }, true), '')
})
