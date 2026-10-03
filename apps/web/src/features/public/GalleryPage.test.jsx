import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  fireEvent.click(screen.getByRole('button', { name: '生活照（CC发布的）' }))
  expect(screen.getByText('没有找到匹配的图集，试试其他关键词。')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
  fireEvent.change(screen.getByLabelText('搜索图集'), { target: { value: 'private123' } })
  expect(screen.queryByRole('button', { name: '打开图集 现场图集' })).toBeNull()
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
