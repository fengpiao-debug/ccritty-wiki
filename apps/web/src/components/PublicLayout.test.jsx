import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'

vi.mock('../features/public/useContent', () => ({ useContent: () => ({ content: { profile: { artistName: '音乐档案' } }, loading: false, hasContent: true }) }))
vi.mock('../features/public/useSiteSettings', () => ({ useSiteSettings: () => ({ settings: { headerName: '音乐档案' }, ready: true, loading: false }) }))

const preventNativeNavigation = (event) => event.preventDefault()
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  document.addEventListener('click', preventNativeNavigation)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.removeEventListener('click', preventNativeNavigation) })

function Page() {
  const { pathname, search, hash } = useLocation()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  return <>
    <h1>{pathname + search + hash}</h1>
    <Link to="/events">页面内活动入口</Link>
    <Link to="/about#contact">联系锚点</Link>
    <button onClick={() => setParams({ tag: '国风' })}>选择标签</button>
    <button onClick={() => navigate(-1)}>返回</button>
    <button onClick={() => navigate(1)}>前进</button>
  </>
}
function mount(path = '/news') {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<PublicLayout />}>
    <Route path="*" element={<Page />} />
  </Route></Routes></MemoryRouter>)
}

const sections = [['主卷', '/'], ['动态', '/news'], ['活动', '/events'], ['影卷', '/gallery'], ['作品', '/music'], ['视频', '/videos']]

it.each(sections)('顶部导航 %s 跨页时在目标内容渲染后回顶，重复点击也能回顶', (name, path) => {
  mount(path === '/news' ? '/events' : '/news')
  const renderedWhenScrolling = []
  window.scrollTo.mockImplementation(() => renderedWhenScrolling.push(screen.getByRole('heading', { level: 1 }).textContent))
  expect(window.scrollTo).not.toHaveBeenCalled()
  const nav = within(screen.getByRole('navigation', { name: '主导航' }))
  for (let i = 0; i < 2; i++) {
    fireEvent.click(nav.getByRole('link', { name, exact: true }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(path)
    expect(window.scrollTo).toHaveBeenCalledTimes(i + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
  }
  expect(renderedWhenScrolling).toEqual([path, path])
})

it('站点名称返回首页和重复点击均回顶，页面内跨栏目入口也回顶', () => {
  mount()
  const brand = within(screen.getByRole('banner')).getByRole('link', { name: '音乐档案', exact: true })
  fireEvent.click(brand)
  fireEvent.click(brand)
  fireEvent.click(screen.getByRole('link', { name: '页面内活动入口' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('/events')
  expect(window.scrollTo).toHaveBeenCalledTimes(3)
})

it('标签筛选、锚点、初始加载和浏览器前进后退不强制回顶', () => {
  mount()
  expect(window.scrollTo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: '页面内活动入口' }))
  expect(window.scrollTo).toHaveBeenCalledTimes(1)
  window.scrollTo.mockClear()
  fireEvent.click(screen.getByRole('button', { name: '选择标签' }))
  fireEvent.click(screen.getByRole('link', { name: '联系锚点' }))
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  fireEvent.click(screen.getByRole('button', { name: '前进' }))
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])('%s 点击导航不会滚动或切换当前页面', (modifier) => {
  mount('/events')
  const nav = within(screen.getByRole('navigation', { name: '主导航' }))
  fireEvent.click(nav.getByRole('link', { name: '活动', exact: true }), { [modifier]: true })
  fireEvent.click(nav.getByRole('link', { name: '作品', exact: true }), { [modifier]: true })
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('/events')
})
