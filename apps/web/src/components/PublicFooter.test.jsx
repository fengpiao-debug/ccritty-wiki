import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicFooter } from './PublicFooter'

// Router 先处理链接；随后阻止 JSDOM 尝试模拟修饰键打开新窗口。
const preventNativeNavigation = (event) => event.preventDefault()
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  document.addEventListener('click', preventNativeNavigation)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.removeEventListener('click', preventNativeNavigation) })

function Page() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  return <>
    <h1>{pathname + search}</h1>
    <Link to="/events">页面内活动入口</Link>
    <button onClick={() => setParams({ tag: '国风' })}>选择标签</button>
    <button onClick={() => navigate(-1)}>返回</button>
    <PublicFooter settings={{ footerName: 'CRITTY · 音乐档案' }} />
  </>
}
function mount(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><Page /></MemoryRouter>)
}
const links = [
  ['CRITTY · 音乐档案', '/'], ['音乐作品', '/music'], ['近期动态', '/news'],
  ['活动行程', '/events'], ['影像记录', '/gallery'], ['视频作品', '/videos'], ['了解更多', '/about'],
]

it.each(links)('页脚 %s 跨页及重复点击当前页时，均在目标内容渲染后回顶', (name, path) => {
  mount(path === '/' ? '/news' : '/')
  const renderedWhenScrolling = []
  window.scrollTo.mockImplementation(() => renderedWhenScrolling.push(screen.getByRole('heading', { level: 1 }).textContent))
  expect(window.scrollTo).not.toHaveBeenCalled()
  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole('link', { name, exact: true }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(path)
    expect(window.scrollTo).toHaveBeenCalledTimes(i + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
  }
  expect(renderedWhenScrolling).toEqual([path, path])
})

it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])('%s 点击不会滚动当前页，也不会影响下一次导航', (modifier) => {
  mount()
  fireEvent.click(screen.getByRole('link', { name: '音乐作品', exact: true }), { [modifier]: true })
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('/')
  expect(window.scrollTo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: '页面内活动入口' }))
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('页脚跳转后，标签筛选和浏览器返回不再触发回顶', () => {
  mount('/news')
  fireEvent.click(screen.getByRole('link', { name: '活动行程' }))
  expect(window.scrollTo).toHaveBeenCalledTimes(1)
  window.scrollTo.mockClear()
  fireEvent.click(screen.getByRole('button', { name: '选择标签' }))
  fireEvent.click(screen.getByRole('button', { name: '选择标签' }))
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  expect(window.scrollTo).not.toHaveBeenCalled()
})
