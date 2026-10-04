import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTags, validateTags } from '@artist-wiki/content-types'

test('tags accept legacy empty values, normalize separators, preserve spaces and reject invalid or excessive input', () => {
  assert.deepEqual(normalizeTags(undefined), [])
  assert.deepEqual(normalizeTags([' 音乐会 ', '南京，现场', '音乐会', 'Live Show']), ['音乐会', '南京', '现场', 'Live Show'])
  assert.equal(validateTags('音乐会，南京'), '')
  assert.equal(validateTags(null), '')
  for (const value of [{ tag: '南京' }, 123, ['南京', {}], ['a'.repeat(41)], Array.from({ length: 21 }, (_, index) => String(index))]) {
    assert.ok(validateTags(value))
  }
})
