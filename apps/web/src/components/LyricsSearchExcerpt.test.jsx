import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LyricsSearchExcerpt } from './LyricsSearchExcerpt'

afterEach(cleanup)

it('shows matching lyrics and neighboring lines without LRC metadata or timestamps', () => {
  const lyrics = '[ti:轮回之境]\n[ar:CRITTY]\n[00:10.00]穿越[00:11.00]古道海域\n[00:15.00]眼程万里\n[00:20.00]寻找轮回之境'
  const { container } = render(<LyricsSearchExcerpt lyrics={lyrics} query="穿越古道海域" />)
  expect(container.textContent).toBe('歌词：穿越古道海域 眼程万里 寻找轮回之境')
  expect(container.querySelector('mark').textContent).toBe('穿越古道海域')
})

it('finds a match deep in long lyrics and bounds the excerpt around it', () => {
  const lyrics = '前面的歌词'.repeat(100) + '穿越古道海域' + '后面的歌词'.repeat(100)
  const { container } = render(<LyricsSearchExcerpt lyrics={lyrics} query="穿越古道海域" />)
  expect(container.querySelector('mark').textContent).toBe('穿越古道海域')
  expect(container.textContent.startsWith('歌词：…')).toBe(true)
  expect(container.textContent.endsWith('…')).toBe(true)
  expect(container.textContent.length).toBeLessThan(100)
})

it('matches plain lyrics with multiple terms, full-width input and literal symbols', () => {
  const { container } = render(<LyricsSearchExcerpt lyrics="ＣＲＩＴＴＹ · 清风入梦 a+b" query="critty 清风 a+b" />)
  expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['ＣＲＩＴＴＹ', '清风', 'a+b'])
})

it('hides excerpts for empty queries, missing lyrics, or metadata-only matches', () => {
  const { container, rerender } = render(<LyricsSearchExcerpt lyrics="[ti:轮回之境]\n[00:10]清风入梦" query="轮回" />)
  expect(container.textContent).toBe('')
  rerender(<LyricsSearchExcerpt lyrics="清风入梦" query=" \t " />)
  expect(container.textContent).toBe('')
  rerender(<LyricsSearchExcerpt query="清风" />)
  expect(container.textContent).toBe('')
})
