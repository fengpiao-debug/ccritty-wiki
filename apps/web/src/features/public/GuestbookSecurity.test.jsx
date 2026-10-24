import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { renderGuestbookMarkdown } from '@artist-wiki/markdown'
import { GuestbookCard, GuestbookMarkdown } from './GuestbookCard'

vi.mock('@artist-wiki/markdown', async importOriginal => {
  const original = await importOriginal()
  return { ...original, renderGuestbookMarkdown: vi.fn(original.renderGuestbookMarkdown) }
})
beforeEach(() => { renderGuestbookMarkdown.mockClear() })
afterEach(cleanup)

function assertSafe(container) {
  // 检查用户内容区域；头像、点赞等应用自身 SVG 图标不属于留言 HTML。
  for (const body of container.querySelectorAll('.markdown-body')) {
  expect(body.querySelector('script, iframe, object, embed, svg, math, form, input, img, style')).toBeNull()
  for (const element of body.querySelectorAll('*')) {
    for (const attribute of element.attributes) expect(attribute.name).not.toMatch(/^on|^srcdoc$|^style$/i)
  }
  for (const link of body.querySelectorAll('a[href]')) expect(new URL(link.getAttribute('href'), 'https://example.com').protocol).toMatch(/^(https?:|mailto:)$/)
  }
}

it.each([
  '<script>alert(document.cookie)</script>',
  '<img src=x onerror="alert(1)">',
  '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
  '[链接](javascript:alert(1))',
  '[链接](jAvAsCrIpT:alert(1))',
  '[链接](java&#x73;cript:alert(1))',
  '[链接](data:text/html;base64,PHNjcmlwdD4=)',
  '[链接](vbscript:msgbox(1))',
  '[链接](file:///etc/passwd)',
  '![表情](data:image/svg+xml;base64,PHN2Zz4=)',
  '![跟踪](https://example.com/tracker.svg)',
  '```html\n<img src=x onerror=alert(1)>\n```',
])('renders hostile Markdown safely in previews and admin/public cards: %s', markdown => {
  const item = { id: 'test', markdown, status: 'approved', createdAt: '2026-10-24T12:00:00Z', assets: [] }
  const { container } = render(<><GuestbookMarkdown>{markdown}</GuestbookMarkdown><GuestbookCard item={item} /><GuestbookCard item={item} mine /><GuestbookCard item={item} admin /></>)
  assertSafe(container)
})

it('sanitizes dangerous HTML even if the Markdown renderer returns unsafe markup', () => {
  renderGuestbookMarkdown.mockReturnValueOnce('<p onclick="alert(1)" style="color:red">正文</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><svg onload=alert(1)></svg><form id="location"><input name="href"></form>')
  const { container } = render(<GuestbookMarkdown>test</GuestbookMarkdown>)
  assertSafe(container)
  expect(container.textContent).toContain('正文')
})

it('retains ordinary Markdown and safe links after sanitization', () => {
  const { container } = render(<GuestbookMarkdown>{'**加粗**\n\n> 引用\n\n- 列表\n\n`代码`\n\n[链接](https://example.com)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'}</GuestbookMarkdown>)
  for (const selector of ['strong', 'blockquote', 'li', 'code', 'table']) expect(container.querySelector(selector)).not.toBeNull()
  const link = container.querySelector('a')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(link.getAttribute('rel')).toContain('noreferrer')
})
