import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesSong, matchesVideo, safeMvUrl, validateMediaMetadata } from '@artist-wiki/content-types'

test('song search includes co-singers, album names and lyrics without LRC tags', () => {
  const song = { title: '牵丝戏', artist: 'Critty / Aki阿杰', album: '古风精选', lyrics: '[00:01.00]听风声\n[00:02.00]等归人' }
  for (const query of ['牵丝', 'AKI', '阿杰', '古风', '听风声', '阿杰 等归人']) assert.equal(matchesSong(song, query), true)
  assert.equal(matchesSong(song, '不存在的歌词'), false)
})
test('video search covers category, author, date, location, keywords and body', () => {
  const video = { title: '舞台记录', category: 'live', authorName: '鱼翅', publishedAt: '2026-10-02T19:30', location: '杭州', description: '生日特别场', keywords: '清唱 返场', markdown: '## 幕后\n补充花絮' }
  for (const query of ['舞台', '直播切片', '鱼翅', '2026-10', '杭州', '生日', '返场', '花絮', '鱼翅 清唱']) assert.equal(matchesVideo(video, query), true)
  assert.equal(matchesVideo(video, '其他'), false)
})
test('MV URLs and video metadata are validated before saving', () => {
  assert.equal(safeMvUrl(' https://www.bilibili.com/video/BV1xx411c7mD '), 'https://www.bilibili.com/video/BV1xx411c7mD')
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://name:secret@example.com/', 'bad']) {
    assert.equal(safeMvUrl(url), '')
    assert.notEqual(validateMediaMetadata('song', { mvUrl: url }), '')
  }
  assert.equal(validateMediaMetadata('song', { mvUrl: '' }), '')
  for (const value of [{ category: 'bad' }, { authorName: [] }, { keywords: 'x'.repeat(2001) }, { publishedAt: '2026-02-30' }]) assert.notEqual(validateMediaMetadata('video', value), '')
  assert.equal(validateMediaMetadata('video', { category: 'mv', authorName: '鱼翅', publishedAt: '2026-10-02T19:30', markdown: '说明' }), '')
})
