// 文件作用：apps/server/src/lyrics.test.js，负责后端服务的独立功能模块。
import test from 'node:test'
import assert from 'node:assert/strict'

function parseLyrics(raw = '') {
  return String(raw).split(/\r?\n/).flatMap((row) => {
    const tags = [...row.matchAll(/\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = row.replace(/\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    return tags.map((tag) => ({ time: Number(tag[1]) * 60 + Number(tag[2]) + Number((tag[3] || '0').padEnd(3, '0')) / 1000, text }))
  }).sort((a, b) => a.time - b.time)
}

test('LRC timestamps are converted into ordered lyric lines', () => {
  assert.deepEqual(parseLyrics('[00:12.50]第二句\n[00:01.00]第一句'), [
    { time: 1, text: '第一句' },
    { time: 12.5, text: '第二句' },
  ])
})
