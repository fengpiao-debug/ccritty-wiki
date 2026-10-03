import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { SiteMetadata } from './SiteMetadata'
import { PublicLayout } from './PublicLayout'
import { SiteSettingsProvider, useSiteSettings } from '../features/public/useSiteSettings'
import { contentApi } from '../lib/api'

vi.mock('../lib/api', () => ({ contentApi: { getSiteSettings: vi.fn() } }))
vi.mock('../features/public/useContent', () => ({ useContent: () => ({ content: { profile: { artistName: '档案歌手' } } }) }))

beforeEach(() => vi.resetAllMocks())
afterEach(() => { cleanup(); document.head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => link.remove()) })

it('替换所有旧 favicon，连续替换及清空后恢复原始图标，标题支持回退', () => {
  document.head.insertAdjacentHTML('beforeend', '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/favicon.png">')
  const icons = () => [...document.head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((link) => link.getAttribute('href'))
  const view = render(<SiteMetadata settings={{ siteTitle: '自定义标题', faviconUrl: '/first.png' }} />)
  expect(document.title).toBe('自定义标题')
  expect(icons()).toEqual(['/first.png', '/first.png'])
  view.rerender(<SiteMetadata settings={{ siteTitle: '新标题', faviconUrl: '/second.png' }} />)
  expect(icons()).toEqual(['/second.png', '/second.png'])
  view.rerender(<SiteMetadata settings={{ siteTitle: '', faviconUrl: '' }} />)
  expect(document.title).toBe(DEFAULT_SITE_SETTINGS.siteTitle)
  expect(icons()).toEqual(['/favicon.ico', '/favicon-32.png', '/favicon.png'])
  expect(document.head.querySelector('link[sizes="32x32"]').type).toBe('image/png')
})

it('前台读取独立的顶部与页脚品牌，图片失败回退文字，视频入口可跳转', async () => {
  contentApi.getSiteSettings.mockResolvedValue({ settings: {
    ...DEFAULT_SITE_SETTINGS, headerName: '顶部名字', headerSubtitle: 'My Archive', headerLogoUrl: '/header.png', headerMarkText: '影',
    footerName: '页脚名字', footerLogoUrl: '/footer.png', footerTagline: '一起收藏音乐',
  } })
  const view = render(<MemoryRouter><SiteSettingsProvider><Routes><Route element={<PublicLayout />}>
    <Route path="/" element={<p>首页内容</p>} /><Route path="/videos" element={<h1>视频页面</h1>} />
  </Route></Routes></SiteSettingsProvider></MemoryRouter>)
  await screen.findByText('顶部名字')
  expect(screen.getByText('My Archive')).toBeTruthy()
  expect(screen.getByText('页脚名字')).toBeTruthy()
  expect(screen.getByText('一起收藏音乐')).toBeTruthy()
  expect(view.container.querySelector('.public-header img').getAttribute('src')).toBe('/header.png')
  expect(view.container.querySelector('.public-footer-brand img').getAttribute('src')).toBe('/footer.png')
  fireEvent.error(view.container.querySelector('.public-header img'))
  expect(view.container.querySelector('.public-header .brand-mark').textContent).toBe('影')
  fireEvent.click(screen.getByRole('link', { name: '视频作品' }))
  expect(await screen.findByRole('heading', { name: '视频页面' })).toBeTruthy()
  contentApi.getSiteSettings.mockResolvedValue({ settings: { headerSubtitle: '', footerTagline: '', headerName: '' } })
  fireEvent.focus(window)
  await screen.findByText('档案歌手')
  expect(screen.queryByText('My Archive')).toBeNull()
  expect(screen.queryByText('一起收藏音乐')).toBeNull()
})

it('较早的读取结果不会覆盖刚保存的品牌设置，后续读取失败也保留已保存内容', async () => {
  let finishRead
  contentApi.getSiteSettings.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve }))
  function SaveProbe() {
    const { settings, updateSettings } = useSiteSettings()
    return <><span>{settings.headerName}</span><button onClick={() => updateSettings({ headerName: '刚保存的名称', siteTitle: '刚保存的标题' })}>模拟保存成功</button></>
  }
  render(<SiteSettingsProvider><SaveProbe /></SiteSettingsProvider>)
  fireEvent.click(screen.getByRole('button', { name: '模拟保存成功' }))
  await act(async () => finishRead({ settings: { headerName: '旧名称', siteTitle: '旧标题' } }))
  expect(screen.getByText('刚保存的名称')).toBeTruthy()
  expect(document.title).toBe('刚保存的标题')
  contentApi.getSiteSettings.mockRejectedValueOnce(new Error('暂时离线'))
  fireEvent.focus(window)
  await waitFor(() => expect(contentApi.getSiteSettings).toHaveBeenCalledTimes(2))
  expect(document.title).toBe('刚保存的标题')
})
