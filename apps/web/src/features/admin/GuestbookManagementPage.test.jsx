import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GuestbookManagementPage } from './GuestbookManagementPage'
import { apiRequest } from '../../lib/api'

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { apiRequest.mockReset() })
afterEach(cleanup)
it('approves a pending message then lets the administrator withdraw the public message', async () => {
  const item = { id: 'review-me', nickname: '小影', markdown: '你好', createdAt: '2026-10-24T10:00:00Z', status: 'pending', assets: [] }
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') { item.status = JSON.parse(options.body).status; return { ok: true } }
    const matching = path.includes(`status=${item.status}`)
    return { items: matching ? [{ ...item }] : [], total: matching ? 1 : 0 }
  })
  render(<GuestbookManagementPage />)
  fireEvent.click(await screen.findByRole('button', { name: '审核通过' }))
  await screen.findByText('暂无此类留言。')
  expect(item.status).toBe('approved')
  fireEvent.click(screen.getByRole('button', { name: '已公开', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: '撤下留言' }))
  await waitFor(() => expect(item.status).toBe('rejected'))
  await screen.findByText('暂无此类留言。')
})

it('keeps the message and reports an unsuccessful review', async () => {
  apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PATCH') throw new Error('审核保存失败')
    return { items: [{ id: 'one', nickname: '小影', markdown: '你好', createdAt: '2026-10-24T10:00:00Z', status: 'pending', assets: [] }], total: 1 }
  })
  render(<GuestbookManagementPage />)
  fireEvent.click(await screen.findByRole('button', { name: '不予通过' }))
  expect((await screen.findByRole('alert')).textContent).toBe('审核保存失败')
  expect(screen.getByText('你好')).toBeTruthy()
})

it('features and unfeatures an approved message and deletes only after explicit confirmation', async () => {
  let item = { id: 'featured-one', markdown: '值得收藏', createdAt: '2026-10-24T10:00:00Z', status: 'approved', featured: false, assets: [] }
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') { item.featured = JSON.parse(options.body).featured; return { ok: true } }
    if (options?.method === 'DELETE') { item = null; return { ok: true } }
    const matching = item && (path.includes('status=approved') || (path.includes('status=featured') && item.featured))
    return { items: matching ? [{ ...item }] : [], total: matching ? 1 : 0 }
  })
  render(<GuestbookManagementPage />)
  await screen.findByText('暂无此类留言。')
  fireEvent.click(screen.getByRole('button', { name: '已公开', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: '设为精选' }))
  fireEvent.click(await screen.findByRole('button', { name: '取消精选' }))
  await screen.findByRole('button', { name: '设为精选' })
  expect(item.featured).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '删除留言' }))
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
  expect(screen.queryByRole('button', { name: '确认删除' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '删除留言' }))
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
  await screen.findByText('暂无此类留言。')
  expect(item).toBeNull()
})

it('shows pending report reasons and submits the chosen moderation action', async () => {
  let resolved = false
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') { resolved = true; return { ok: true } }
    return { items: !resolved && path.includes('status=reported') ? [{ id: 'reported', markdown: '被举报的留言', status: 'approved', createdAt: '2026-10-24T10:00:00Z', assets: [], reportCount: 2, reportReasons: [{ reason: 'spam', total: 2 }] }] : [], total: !resolved && path.includes('status=reported') ? 1 : 0 }
  })
  render(<GuestbookManagementPage />)
  await screen.findByText('暂无此类留言。')
  fireEvent.click(screen.getByRole('button', { name: '待处理举报' }))
  await screen.findByText('2 条待处理举报：广告或垃圾信息 2 条')
  fireEvent.click(screen.getByRole('button', { name: '举报成立并撤下' }))
  await screen.findByText('暂无此类留言。')
  const mutation = apiRequest.mock.calls.find(([, options]) => options?.method === 'PATCH')
  expect(mutation[0]).toBe('/admin/guestbook/reported/reports')
  expect(JSON.parse(mutation[1].body)).toEqual({ action: 'withdraw' })
})
