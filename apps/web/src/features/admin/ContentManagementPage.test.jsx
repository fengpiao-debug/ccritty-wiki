import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ContentManagementPage } from './ContentManagementPage'
import { adminModules } from './adminModules'
import { contentApi } from '../../lib/api'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => false }) }))
vi.mock('../../lib/api', () => ({ contentApi: { getAdminContent: vi.fn() } }))

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

function rowTitles() {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].querySelector('strong')?.textContent)
}

const records = [
  { id: 'older', title: '较早更新', updatedAt: '2026-10-04T09:00:00+08:00' },
  { id: 'missing', title: '没有时间' },
  { id: 'newer', title: '最近更新', updatedAt: '2026-10-04T02:00:00Z' },
  { id: 'invalid', title: '无效时间', updatedAt: 'invalid' },
  { id: 'tie', title: '同时更新', updatedAt: '2026-10-04T10:00:00+08:00' },
]

it.each(adminModules.filter((module) => module.type !== 'profile'))('$label 默认按真实更新时间降序，切换升序后无时间记录仍置底', async (module) => {
  contentApi.getAdminContent.mockResolvedValue({ [module.key]: records })
  render(<ContentManagementPage module={module} />)
  await screen.findByText('最近更新')
  expect(rowTitles()).toEqual(['最近更新', '同时更新', '较早更新', '没有时间', '无效时间'])
  expect(screen.getByRole('columnheader', { name: /更新时间/ }).getAttribute('aria-sort')).toBe('descending')

  fireEvent.click(screen.getByRole('button', { name: '更新时间 最新' }))
  expect(rowTitles()).toEqual(['较早更新', '最近更新', '同时更新', '没有时间', '无效时间'])
  expect(screen.getByRole('columnheader', { name: /更新时间/ }).getAttribute('aria-sort')).toBe('ascending')
  expect(screen.getByRole('row', { name: /无效时间/ }).textContent).toContain('—')

  fireEvent.click(screen.getByRole('button', { name: '更新时间 最早' }))
  expect(rowTitles()).toEqual(['最近更新', '同时更新', '较早更新', '没有时间', '无效时间'])
  expect(records.map((item) => item.id)).toEqual(['older', 'missing', 'newer', 'invalid', 'tie'])
})

it('排序可组合搜索、分类、删除状态，刷新数据后保持顺序', async () => {
  const videos = [
    { id: 'old', title: '现场旧视频', category: 'live', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'new', title: '现场新视频', category: 'live', updatedAt: '2026-10-03T00:00:00Z' },
    { id: 'deleted', title: '现场已删除', category: 'live', updatedAt: '2026-10-02T00:00:00Z', deletedAt: '2026-10-04T00:00:00Z' },
    { id: 'other', title: '其他视频', category: 'other', updatedAt: '2026-10-04T00:00:00Z' },
  ]
  contentApi.getAdminContent.mockResolvedValue({ videos })
  render(<ContentManagementPage module={adminModules.find((module) => module.type === 'video')} />)
  await screen.findByText('现场旧视频')
  fireEvent.click(screen.getByRole('button', { name: '更新时间 最新' }))
  fireEvent.change(screen.getByRole('combobox', { name: '筛选视频分类' }), { target: { value: 'live' } })
  expect(rowTitles()).toEqual(['现场旧视频', '现场新视频'])
  fireEvent.change(screen.getByRole('combobox', { name: '筛选内容状态' }), { target: { value: 'all' } })
  expect(rowTitles()).toEqual(['现场旧视频', '现场已删除', '现场新视频'])
  fireEvent.change(screen.getByRole('textbox', { name: '搜索内容' }), { target: { value: '新视频' } })
  expect(rowTitles()).toEqual(['现场新视频'])
  fireEvent.change(screen.getByRole('textbox', { name: '搜索内容' }), { target: { value: '' } })
  fireEvent.change(screen.getByRole('combobox', { name: '筛选内容状态' }), { target: { value: 'deleted' } })
  expect(rowTitles()).toEqual(['现场已删除'])
  fireEvent.change(screen.getByRole('combobox', { name: '筛选内容状态' }), { target: { value: 'active' } })

  contentApi.getAdminContent.mockResolvedValue({ videos: videos.map((item) => item.id === 'old' ? { ...item, updatedAt: '2026-10-05T00:00:00Z' } : item) })
  fireEvent.click(screen.getByRole('button', { name: '刷新内容' }))
  await waitFor(() => expect(rowTitles()).toEqual(['现场新视频', '现场旧视频']))
  expect(screen.getByRole('columnheader', { name: /更新时间/ }).getAttribute('aria-sort')).toBe('ascending')
})
