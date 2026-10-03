import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SearchHighlight } from './SearchHighlight'

afterEach(cleanup)
const highlights = (container) => [...container.querySelectorAll('mark')].map((mark) => mark.textContent)

it('highlights every occurrence and restores plain text when cleared', () => {
  const { container, rerender } = render(<SearchHighlight query="轮回">轮回之境 · 再入轮回</SearchHighlight>)
  expect(highlights(container)).toEqual(['轮回', '轮回'])
  expect(container.textContent).toBe('轮回之境 · 再入轮回')
  rerender(<SearchHighlight query=" \t ">轮回之境 · 再入轮回</SearchHighlight>)
  expect(highlights(container)).toEqual([])
  expect(container.textContent).toBe('轮回之境 · 再入轮回')
})

it('preserves full-width, combined and expanded characters when matching multiple words', () => {
  const text = 'ＣＲＩＴＴＹ · Café · Cafe\u0301 · ﬃ · 😀轮回'
  const { container } = render(<SearchHighlight query="critty CAFÉ ffi 轮回">{text}</SearchHighlight>)
  expect(highlights(container)).toEqual(['ＣＲＩＴＴＹ', 'Café', 'Cafe\u0301', 'ﬃ', '轮回'])
  expect(container.textContent).toBe(text)
})

it('merges overlapping matches without duplicating text', () => {
  const { container } = render(<SearchHighlight query="轮回 回之 轮回之">轮回之境</SearchHighlight>)
  expect(highlights(container)).toEqual(['轮回之'])
  expect(container.textContent).toBe('轮回之境')
})

it('treats search terms and content as literal text, including HTML and regex symbols', () => {
  const text = '<img src=x onerror=alert(1)> [轮回] a+b .*'
  const { container } = render(<SearchHighlight query="<img [轮回] a+b .*">{text}</SearchHighlight>)
  expect(highlights(container)).toEqual(['<img', '[轮回]', 'a+b', '.*'])
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toBe(text)
})
