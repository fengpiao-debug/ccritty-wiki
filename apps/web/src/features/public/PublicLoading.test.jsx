// 延迟公开接口，重现测试站刷新时先显示演示资料的问题。
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const api = vi.hoisted(() => ({ getPublic: vi.fn(), getSiteSettings: vi.fn() }))
vi.mock('../../lib/api', () => ({ contentApi: api }))
let PublicLayout, HomePage, SiteSettingsProvider, useContent
const content = {
  profile: { artistName: '真实歌手', biographyTitle: '简介', markdown: '真实简介正文' },
  news: [
    { id: 'old', title: '最旧消息', publishedAt: '2015-01-03' },
    { id: 'unknown', title: '待定消息', publishedAt: 'invalid' },
    { id: 'middle', title: '较新消息', publishedAt: '2025-01-01' },
    { id: 'new', title: '最新消息', publishedAt: '2026-10-01' },
  ],
}
const settings = { headerName: '真实站名', siteTitle: '真实标题', footerName: '真实页脚', contactEmail: 'real@example.test' }
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  ;({ PublicLayout } = await import('../../components/PublicLayout'))
  ;({ HomePage } = await import('./HomePage'))
  ;({ SiteSettingsProvider } = await import('./useSiteSettings'))
  ;({ useContent } = await import('./useContent'))
  document.title = '加载中…'
})
afterEach(cleanup)
function PlayerProbe() {
  const state = useContent()
  return <span data-testid="player-songs">{state.content.songs.map((song) => song.title).join(',')}</span>
}
function mount() {
  return render(<MemoryRouter><SiteSettingsProvider><PlayerProbe /><Routes><Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /></Route></Routes></SiteSettingsProvider></MemoryRouter>)
}
function expectNoDemo() {
  for (const text of ['锦书', 'Critty熙影', '新曲动态', '未来活动示例', 'hello@example.com', '牵丝戏']) {
    expect(screen.queryByText(text, { exact: false })).toBeNull()
  }
}

it.each(['content', 'settings'])('慢速 %s 请求期间不渲染演示资料，加载完成后首页近讯按最新日期排序', async (slow) => {
  const request = deferred()
  api.getPublic.mockImplementation(() => slow === 'content' ? request.promise : Promise.resolve(content))
  api.getSiteSettings.mockImplementation(() => slow === 'settings' ? request.promise : Promise.resolve({ settings }))
  mount()
  expect(screen.getByRole('status').textContent).toContain('正在加载档案')
  expectNoDemo()
  await waitFor(() => expect(api.getPublic).toHaveBeenCalledTimes(1))
  expectNoDemo()
  expect(screen.queryByText('真实简介正文')).toBeNull()
  if (slow === 'settings') expect(document.title).toBe('加载中…')
  await act(async () => request.resolve(slow === 'content' ? content : { settings }))
  expect(await screen.findByRole('heading', { name: '真实歌手' })).toBeTruthy()
  expect(screen.getByText('简介', { exact: true })).toBeTruthy()
  expectNoDemo()
  expect(document.title).toBe('真实标题')
  expect([...document.querySelectorAll('.latest-item strong')].map((node) => node.textContent)).toEqual(['最新消息', '较新消息', '最旧消息'])
  expect(screen.getByTestId('player-songs').textContent).toBe('')
})

it.each(['content', 'settings'])('%s 首次请求失败显示重试，重试成功后所有使用者同步真实资料', async (failed) => {
  api.getPublic.mockResolvedValue(content)
  api.getSiteSettings.mockResolvedValue({ settings })
  api[failed === 'content' ? 'getPublic' : 'getSiteSettings'].mockRejectedValueOnce(new Error('网络暂不可用'))
  mount()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '档案暂时无法加载，请重试。重新加载')
  expectNoDemo()
  const recovered = { ...content, songs: [{ id: 'real', title: '真实歌曲' }] }
  api.getPublic.mockResolvedValue(recovered)
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
  expect(await screen.findByRole('heading', { name: '真实歌手' })).toBeTruthy()
  await waitFor(() => expect(screen.getByTestId('player-songs').textContent).toBe('真实歌曲'))
  expectNoDemo()
})

it('已有真实数据时重新请求失败保留页面内容', async () => {
  api.getPublic.mockResolvedValue(content)
  api.getSiteSettings.mockResolvedValue({ settings })
  mount()
  await screen.findByRole('heading', { name: '真实歌手' })
  await act(async () => {})
  api.getSiteSettings.mockRejectedValueOnce(new Error('离线'))
  fireEvent.focus(window)
  await waitFor(() => expect(api.getSiteSettings).toHaveBeenCalledTimes(2))
  expect(screen.getByText('真实站名')).toBeTruthy()
  expect(screen.getByText('真实页脚')).toBeTruthy()
  expect(document.title).toBe('真实标题')
  expectNoDemo()
})
