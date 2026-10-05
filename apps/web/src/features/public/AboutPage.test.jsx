import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { AboutPage } from './AboutPage'

afterEach(cleanup)
function mount(settings = {}, state = {}) {
  return render(<MemoryRouter><Routes><Route element={<Outlet context={{ settings: { ...DEFAULT_SITE_SETTINGS, ...settings }, loading: false, error: '', ...state }} />}>
    <Route path="/" element={<AboutPage />} />
  </Route></Routes></MemoryRouter>)
}

it('renders email links, member tables and separators as Markdown, with QR and Weibo below', () => {
  const { container } = mount({ aboutMarkdown: '## 联系我们\n\n[hello@critty.cc](mailto:hello@critty.cc)\n\n---\n\n| | | |\n| --- | --- | --- |\n| yingfeng | 青春不散 | 镜谭无双 |', aboutQrCodeUrl: '/uploads/images/qr.png', aboutWeiboUrl: 'https://weibo.com/example' })
  expect(screen.getByRole('link', { name: 'hello@critty.cc' }).getAttribute('href')).toBe('mailto:hello@critty.cc')
  expect(screen.getByRole('cell', { name: '青春不散' })).toBeTruthy()
  expect(screen.getByRole('separator')).toBeTruthy()
  expect(screen.getByAltText('关于页面二维码').getAttribute('src')).toBe('/uploads/images/qr.png')
  expect(screen.getByRole('link', { name: '查看二维码原图' }).getAttribute('href')).toBe('/uploads/images/qr.png')
  const weibo = screen.getByRole('link', { name: '访问微博' })
  expect(weibo.getAttribute('href')).toBe('https://weibo.com/example')
  expect(weibo.getAttribute('target')).toBe('_blank')
  expect(weibo.getAttribute('rel')).toContain('noopener')
  expect(container.querySelector('script')).toBeNull()
})

it('hides unset contact fields and supports a contact-only page', () => {
  const view = mount({ aboutWeiboUrl: 'https://weibo.com/example' })
  expect(screen.getByRole('link', { name: '访问微博' })).toBeTruthy()
  expect(screen.queryByAltText('关于页面二维码')).toBeNull()
  expect(screen.queryByText('关于信息尚未填写。')).toBeNull()
  view.unmount(); mount()
  expect(screen.queryByRole('heading', { name: '关注与交流' })).toBeNull()
  expect(screen.getByText('关于信息尚未填写。')).toBeTruthy()
})

it('does not show stale contact information while settings are loading or failed', () => {
  const settings = { aboutQrCodeUrl: '/qr.png', aboutWeiboUrl: 'https://weibo.com/example' }
  const view = mount(settings, { loading: true })
  expect(screen.getByRole('status').textContent).toContain('正在加载')
  expect(screen.queryByRole('link', { name: '访问微博' })).toBeNull()
  view.unmount(); mount(settings, { error: 'offline' })
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.queryByAltText('关于页面二维码')).toBeNull()
})
