import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PHOTO_CATEGORIES } from '@artist-wiki/content-types'
import { GalleryPage } from './GalleryPage'

const fixture = vi.hoisted(() => ({ photos: [] }))
vi.mock('./useContent', () => ({ useContent: () => ({ content: fixture, loading: false }) }))
beforeEach(() => {
  fixture.photos = [{ id: 'a', title: '现场图集', category: 'event', authorType: 'fan', authorName: '小林', fanId: 'private123', showFanId: false, location: '杭州', publishedAt: '2026-10-02T19:30', coverImageId: 'b',
    images: [{ id: 'a', url: '/uploads/images/a.jpg', keywords: '舞台 红裙', description: '返场' }, { id: 'b', url: '/uploads/images/b.jpg', keywords: '合影' }] },
  { id: 'old', title: '旧照片', url: '/uploads/images/old.jpg', caption: '旧的说明' }]
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open') } })
})
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; vi.restoreAllMocks() })

it('filters by metadata, per-image keywords and category, but excludes hidden fan IDs', () => {
  render(<GalleryPage />)
  expect(screen.getByAltText('现场图集').getAttribute('src')).toBe('/uploads/images/b.jpg')
  fireEvent.change(screen.getByLabelText('搜索图集'), { target: { value: '杭州 红裙' } })
  expect(screen.getByRole('button', { name: '打开图集 现场图集' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '打开图集 现场图集' }).querySelector('mark').textContent).toBe('杭州')
  expect(screen.queryByRole('button', { name: '打开图集 旧照片' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: PHOTO_CATEGORIES.find((category) => category.value === 'life').label, exact: true }))
  expect(screen.getByText('没有找到匹配的图集，试试其他关键词。')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
  fireEvent.change(screen.getByLabelText('搜索图集'), { target: { value: 'private123' } })
  expect(screen.queryByRole('button', { name: '打开图集 现场图集' })).toBeNull()
})

it('toggles chronological order and keeps missing or invalid dates last without changing source records', () => {
  fixture.photos = [
    { id: 'missing', title: '无日期' },
    { id: 'earliest', title: '最早图集', publishedAt: '2025-09-14T19:30' },
    { id: 'invalid', title: '无效日期', publishedAt: 'invalid' },
    { id: 'latest', title: '最新图集', publishedAt: '2025-11-22T19:30' },
    { id: 'same', title: '同一时间', publishedAt: '2025-11-22T19:30' },
  ]
  const original = structuredClone(fixture.photos)
  render(<GalleryPage />)
  const titles = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  const sorting = within(screen.getByRole('group', { name: '图集时间排序' }))
  expect(titles()).toEqual(['最新图集', '同一时间', '最早图集', '无日期', '无效日期'])
  fireEvent.click(sorting.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['最早图集', '最新图集', '同一时间', '无日期', '无效日期'])
  fireEvent.click(sorting.getByRole('button', { name: '最早' }))
  expect(titles()).toEqual(['最新图集', '同一时间', '最早图集', '无日期', '无效日期'])
  expect(fixture.photos).toEqual(original)
})

it('combines sorting with search and category filters and retains the order when filters reset', () => {
  fixture.photos = [
    { id: 'new', title: '杭州新现场', category: 'event', publishedAt: '2026-10-02T20:00' },
    { id: 'old', title: '杭州旧现场', category: 'event', publishedAt: '2026-10-02T19:00' },
    { id: 'life', title: '杭州日常', category: 'life', publishedAt: '2026-10-01' },
    { id: 'other', title: '上海现场', category: 'event', publishedAt: '2026-09-01' },
    { id: 'missing', title: '杭州待补日期', category: 'event' },
  ]
  render(<GalleryPage />)
  const titles = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  fireEvent.change(screen.getByLabelText('搜索图集'), { target: { value: '杭州' } })
  fireEvent.click(screen.getByRole('button', { name: PHOTO_CATEGORIES.find((category) => category.value === 'event').label, exact: true }))
  expect(titles()).toEqual(['杭州新现场', '杭州旧现场', '杭州待补日期'])
  fireEvent.click(screen.getByRole('button', { name: '最新', exact: true }))
  expect(titles()).toEqual(['杭州旧现场', '杭州新现场', '杭州待补日期'])
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
  expect(titles()).toEqual(['上海现场', '杭州日常', '杭州旧现场', '杭州新现场', '杭州待补日期'])
  expect(screen.getByRole('button', { name: '最早', exact: true })).toBeTruthy()
})

it('opens the cover first, browses all photos and restores focus on close', () => {
  render(<GalleryPage />)
  const button = screen.getByRole('button', { name: '打开图集 现场图集' })
  button.focus(); fireEvent.click(button)
  const dialog = screen.getByRole('dialog', { name: '现场图集' })
  expect(within(dialog).getByRole('status').textContent).toBe('2 / 2')
  fireEvent.click(within(dialog).getByRole('button', { name: '下一张图片' }))
  expect(within(dialog).getByRole('status').textContent).toBe('1 / 2')
  expect(within(dialog).getByText('舞台 红裙')).toBeTruthy()
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
  expect(within(dialog).getByRole('status').textContent).toBe('2 / 2')
  fireEvent.click(screen.getByRole('button', { name: '关闭图集' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(button)
  expect(document.body.style.overflow).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '打开图集 旧照片' }))
  expect(screen.getByRole('dialog').textContent).toContain('旧的说明')
  expect(screen.queryByRole('button', { name: '下一张图片' })).toBeNull()
})

it.each(['background', 'button', 'escape'])('previews the selected photo in place and closes only the preview via %s', (closeBy) => {
  render(<GalleryPage />)
  const card = screen.getByRole('button', { name: '打开图集 现场图集' })
  card.focus(); fireEvent.click(card)
  const album = screen.getByRole('dialog', { name: '现场图集' })
  album.scrollTop = 120
  const trigger = within(album).getByRole('button', { name: '放大查看第 2 张图片' })
  trigger.focus(); fireEvent.click(within(trigger).getByRole('img'))
  const preview = screen.getByRole('dialog', { name: '图片预览：合影' })
  const photo = within(preview).getByRole('img')
  expect(photo.getAttribute('src')).toBe('/uploads/images/b.jpg')
  expect(screen.queryByRole('link', { name: /查看原图/ })).toBeNull()
  fireEvent.click(photo)
  fireEvent.keyDown(preview, { key: 'ArrowRight' })
  expect(screen.getByRole('dialog', { name: '图片预览：合影' })).toBe(preview)
  expect(within(album).getByRole('status').textContent).toBe('2 / 2')
  if (closeBy === 'background') fireEvent.click(preview)
  else if (closeBy === 'button') fireEvent.click(within(preview).getByRole('button', { name: '关闭图片预览' }))
  else fireEvent(preview, new Event('cancel', { bubbles: true, cancelable: true }))
  expect(screen.queryByRole('dialog', { name: /^图片预览/ })).toBeNull()
  expect(screen.getByRole('dialog', { name: '现场图集' })).toBe(album)
  expect(album.scrollTop).toBe(120)
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.activeElement).toBe(trigger)
  fireEvent.keyDown(album, { key: 'ArrowRight' })
  expect(within(album).getByRole('status').textContent).toBe('1 / 2')
  fireEvent.click(within(album).getByRole('button', { name: '关闭图集' }))
  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).toBe(card)
})

it('previews the current thumbnail through the text action and can retry a failed image', () => {
  render(<GalleryPage />)
  fireEvent.click(screen.getByRole('button', { name: '打开图集 现场图集' }))
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 张图片' }))
  const trigger = screen.getByRole('button', { name: '查看大图' })
  trigger.focus(); fireEvent.click(trigger)
  const preview = screen.getByRole('dialog', { name: '图片预览：返场' })
  expect(within(preview).getByRole('img').getAttribute('src')).toBe('/uploads/images/a.jpg')
  fireEvent.error(within(preview).getByRole('img'))
  expect(within(preview).getByRole('alert').textContent).toContain('图片暂时无法加载')
  fireEvent.click(within(preview).getByRole('button', { name: '关闭图片预览' }))
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  expect(within(screen.getByRole('dialog', { name: '图片预览：返场' })).getByRole('img')).toBeTruthy()
})

it('supports a single-photo album and releases the scroll lock when both dialogs unmount', () => {
  document.body.style.overflow = 'auto'
  const view = render(<GalleryPage />)
  fireEvent.click(screen.getByRole('button', { name: '打开图集 旧照片' }))
  fireEvent.click(screen.getByRole('button', { name: '放大查看第 1 张图片' }))
  expect(within(screen.getByRole('dialog', { name: /^图片预览/ })).getByRole('img').getAttribute('src')).toBe('/uploads/images/old.jpg')
  view.unmount()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('auto')
  document.body.style.overflow = ''
})
