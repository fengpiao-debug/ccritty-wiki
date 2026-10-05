import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '@artist-wiki/markdown'

test('renders about page mail links, separators and member tables with empty headers', () => {
  const html = renderMarkdown('## 联系我们\r\n\r\n联系邮箱：[hello@critty.cc](mailto:hello@critty.cc)\r\n\r\n---\r\n\r\n## 项目组成员\r\n\r\n| | | |\r\n| --- | --- | --- |\r\n| yingfeng | 青春不散 | 镜谭无双 |')
  assert.match(html, /<h2>联系我们<\/h2>/)
  assert.match(html, /<a href="mailto:hello@critty.cc">hello@critty.cc<\/a>/)
  assert.match(html, /<hr>/)
  assert.match(html, /<table>/)
  assert.equal((html.match(/<th>/g) || []).length, 3)
  assert.match(html, /<td>青春不散<\/td>/)
  assert.doesNotMatch(html, /\| ---/)
})

test('renders nested lists, quotes, images and code without interpreting code as markdown', () => {
  const html = renderMarkdown('- **欢迎**\n  - *投稿*\n\n1. 整理\n2. 分享\n\n> 引用\n\n![二维码](/uploads/images/qr.png)\n\n`**原样**`\n\n```html\n<script>alert(1)</script>\n```')
  assert.match(html, /<ul>[\s\S]*<ul>/)
  assert.match(html, /<ol>/)
  assert.match(html, /<blockquote>/)
  assert.match(html, /<img src="\/uploads\/images\/qr.png" alt="二维码">/)
  assert.match(html, /<code>\*\*原样\*\*<\/code>/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('escapes raw HTML and blocks dangerous link and image schemes', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert(1))\n\n[实体](javascript&#x3a;alert(1))\n\n![坏图片](data:text/html;base64,PHNjcmlwdD4=)\n\n[文件](file:///etc/passwd)')
  assert.doesNotMatch(html, /<(?:script|img)\b/i)
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript|data|file):/i)
  assert.match(html, /&lt;img/)
})

test('external links open safely while mail and site links keep their normal behavior', () => {
  const html = renderMarkdown('[微博](https://weibo.com/example?a=1&b=2)\n\n[关于](/about)\n\n[邮箱](mailto:test@example.com)')
  assert.match(html, /href="https:\/\/weibo.com\/example\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /<a href="\/about">关于<\/a>/)
  assert.match(html, /<a href="mailto:test@example.com">邮箱<\/a>/)
  assert.equal(renderMarkdown(null), '')
})
