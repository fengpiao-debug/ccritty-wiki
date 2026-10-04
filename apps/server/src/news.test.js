import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNewsKind, validateNewsKind } from '@artist-wiki/content-types'

test('news identifiers allow presets, custom text and clearing, while rejecting invalid or oversized input', () => {
  for (const value of ['新歌发布', 'MV发布', '幕后花絮', '新'.repeat(20), '', '   ', undefined, null]) assert.equal(validateNewsKind(value), '')
  assert.equal(normalizeNewsKind('  MV发布  '), 'MV发布')
  assert.equal(normalizeNewsKind('   '), '')
  assert.equal(normalizeNewsKind(undefined), '')
  assert.equal(validateNewsKind('新'.repeat(21)), '动态标识最多 20 个字符')
  for (const value of [123, {}, ['新歌发布'], true]) assert.equal(validateNewsKind(value), '动态标识必须是文字')
})
