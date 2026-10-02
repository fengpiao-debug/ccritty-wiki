import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VideoPage } from './VideoPage'

const fixture = vi.hoisted(() => ({ videos: [] }))
const dialogMethods = Object.fromEntries(['showModal', 'close'].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]))
vi.mock('./useContent', () => ({ useContent: () => ({ content: fixture }) }))
vi.mock('../../lib/bilibiliJsonp', () => ({ resolveBilibiliJsonp: vi.fn(() => Promise.resolve({})) }))

beforeEach(() => {
  fixture.videos = [
    { id: 'a', title: 'Video A', bvid: 'BV1xx411c7mD', cover: '/cover-a.jpg' },
    { id: 'b', title: 'Video B', bvid: 'av170001', cover: '/cover-b.jpg' },
  ]
  // jsdom does not implement native dialog opening or focus management.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function () {
    this.setAttribute('open', '')
    this.querySelector('button').focus()
  }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn(function () {
    this.removeAttribute('open')
  }) })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else delete HTMLDialogElement.prototype[name]
  }
  document.body.style.overflow = ''
})

describe('Video playback dialog', () => {
  it('loads one autoplay player outside the thumbnail grid only after clicking', () => {
    const { container } = render(<VideoPage />)
    expect(document.querySelector('iframe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '播放 Video A' }))
    const dialog = screen.getByRole('dialog', { name: 'Video A' })
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
    expect(container.contains(dialog)).toBe(false)
    expect(dialog.querySelector('iframe').src).toContain('autoplay=1')
    expect(dialog.querySelector('iframe').hasAttribute('allowfullscreen')).toBe(true)
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect(container.querySelectorAll('.video-cover')).toHaveLength(2)
    expect(container.querySelector('.video-frame iframe')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('unloads playback, restores scrolling and returns focus on close', () => {
    document.body.style.overflow = 'auto'
    render(<VideoPage />)
    const trigger = screen.getByRole('button', { name: '播放 Video A' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭视频' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭视频' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(screen.getByRole('button', { name: '播放 Video B' }))
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect(document.querySelector('iframe').src).toContain('aid=170001')
  })

  it('closes on native Escape cancellation and backdrop, but not content clicks', () => {
    render(<VideoPage />)
    fireEvent.click(screen.getByRole('button', { name: '播放 Video A' }))
    fireEvent.click(screen.getByRole('dialog').querySelector('header'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '播放 Video B' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('restores scrolling and removes the player when the page unmounts', () => {
    const { unmount } = render(<VideoPage />)
    fireEvent.click(screen.getByRole('button', { name: '播放 Video A' }))
    unmount()
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not load a player for invalid video sources or an empty list', () => {
    fixture.videos = [{ id: 'invalid', title: 'Invalid', bvid: 'invalid' }]
    const { unmount } = render(<VideoPage />)
    expect(screen.getByRole('button', { name: '播放 Invalid' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '播放 Invalid' }))
    expect(document.querySelector('iframe')).toBeNull()
    unmount()
    fixture.videos = []
    render(<VideoPage />)
    expect(screen.getByText('视频档案尚未建立。')).toBeTruthy()
  })
})

it('视频分类与搜索覆盖作者和正文，详情显示所有补充字段', () => {
  fixture.videos = [{ id: 'full', title: '秋日现场', bvid: 'BV1xx411c7mD', cover: '/cover.jpg', category: 'event', authorName: '鱼翅', publishedAt: '2026-10-02T19:30', location: '杭州', keywords: '返场 合唱', description: '现场记录', markdown: '## 幕后故事\n演出花絮' },
    { id: 'vlog', title: '日常记录', cover: '/cover.jpg', category: 'vlog' }]
  render(<VideoPage />)
  fireEvent.change(screen.getByLabelText('搜索视频'), { target: { value: '鱼翅 花絮' } })
  expect(screen.getByRole('button', { name: '播放 秋日现场' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '播放 日常记录' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'vlog', exact: true }))
  expect(screen.getByText('没有找到匹配的视频，试试其他关键词。')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
  fireEvent.click(screen.getByRole('button', { name: '播放 秋日现场' }))
  const detail = screen.getByRole('dialog')
  expect(detail.textContent).toContain('作者：鱼翅')
  expect(detail.textContent).toContain('杭州')
  expect(detail.textContent).toContain('返场 合唱')
  expect(detail.querySelector('h2').textContent).toBe('秋日现场')
  expect(screen.getByRole('heading', { name: '幕后故事' })).toBeTruthy()
})
