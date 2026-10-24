import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GuestbookCard } from './GuestbookCard'
import { guestbookRequest } from './guestbookApi'

vi.mock('./guestbookApi', () => ({ guestbookRequest: vi.fn(), getGuestbookImage: vi.fn() }))
const item = { id: 'one', markdown: '匿名留言', status: 'approved', createdAt: '2026-10-24T10:00:00Z', assets: [], liked: false, likeCount: 0, reported: false }
beforeEach(() => { guestbookRequest.mockReset() })
afterEach(cleanup)

it('supports anonymous like and unlike without a login or reply control', async () => {
  guestbookRequest.mockResolvedValueOnce({ liked: true, likeCount: 1 }).mockResolvedValueOnce({ liked: false, likeCount: 0 })
  render(<GuestbookCard item={item} />)
  expect(screen.queryByRole('button', { name: /回复|登录/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '点赞', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: '取消点赞' }))
  await screen.findByRole('button', { name: '点赞', exact: true })
  expect(JSON.parse(guestbookRequest.mock.calls[0][1].body)).toEqual({ liked: true })
  expect(JSON.parse(guestbookRequest.mock.calls[1][1].body)).toEqual({ liked: false })
})

it('collects a report reason, submits it and prevents duplicate reporting', async () => {
  guestbookRequest.mockResolvedValue({ reported: true, message: '举报已提交，管理员会核查处理。' })
  render(<GuestbookCard item={item} />)
  fireEvent.click(screen.getByRole('button', { name: '举报', exact: true }))
  expect(guestbookRequest).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('举报原因'), { target: { value: 'abuse' } })
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('举报已提交，管理员会核查处理。')
  expect(screen.getByRole('button', { name: '已举报' }).disabled).toBe(true)
  expect(JSON.parse(guestbookRequest.mock.calls[0][1].body)).toEqual({ reason: 'abuse' })
})

it('preserves like state on failure and never offers interactions on a pending message', async () => {
  guestbookRequest.mockRejectedValue(new Error('操作失败'))
  const view = render(<GuestbookCard item={item} />)
  fireEvent.click(screen.getByRole('button', { name: '点赞', exact: true }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: '点赞', exact: true }).getAttribute('aria-pressed')).toBe('false')
  view.rerender(<GuestbookCard item={{ ...item, status: 'pending' }} mine />)
  expect(screen.queryByRole('button', { name: '点赞', exact: true })).toBeNull()
  expect(screen.queryByRole('button', { name: '举报', exact: true })).toBeNull()
})
