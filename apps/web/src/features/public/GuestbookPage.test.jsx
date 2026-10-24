import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GuestbookPage } from './GuestbookPage'
import { guestbookRequest } from './guestbookApi'

vi.mock('./guestbookApi', () => ({ guestbookRequest: vi.fn(), getGuestbookImage: vi.fn() }))
beforeEach(() => { guestbookRequest.mockReset(); localStorage.clear(); vi.stubGlobal('alert', vi.fn()) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const pending = { id: 'one', nickname: '小影', markdown: '**喜欢** 😊', status: 'pending', createdAt: '2026-10-24T12:00:00Z', assets: [] }
const notice = '留言已提交，审核通过后将会展示'
async function editor() { return screen.findByLabelText('留言内容') }
async function type(text) {
  fireEvent.input(await editor(), { target: { value: text } })
  await act(async () => {})
}

it('uses the real Waline composer with anonymous submission, notice and owner preview', async () => {
  const warnings = vi.spyOn(console, 'warn')
  guestbookRequest.mockImplementation(async (path, options) => options?.method === 'POST' ? { item: pending } : { items: path.startsWith('/mine') ? [pending] : [], total: path.startsWith('/mine') ? 1 : 0 })
  const { container } = render(<GuestbookPage />)
  await editor()
  expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Invalid prop|Feature flags/)
  expect(container.querySelector('[data-waline]')).toBeTruthy()
  expect(screen.queryByLabelText('昵称')).toBeNull()
  expect(screen.queryByRole('button', { name: '登录' })).toBeNull()
  expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
  await type('**喜欢** 😊')
  fireEvent.click(screen.getByTitle('预览'))
  await waitFor(() => expect(screen.getByText('喜欢').tagName).toBe('STRONG'))
  fireEvent.click(screen.getByRole('button', { name: '提交留言' }))
  await screen.findByText(notice)
  await screen.findByText('待审核 · 仅本人可见')
  const sent = guestbookRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body
  expect(sent.get('markdown')).toBe('**喜欢** 😊')
  expect(sent.has('nickname')).toBe(false)
  expect(screen.queryByText('小影')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '大家的留言' }))
  await screen.findByText('还没有公开留言，来留下第一句话吧。')
  expect(screen.queryByText('待审核 · 仅本人可见')).toBeNull()
})

it('failed submission preserves the Waline draft for retry and shows no success toast', async () => {
  guestbookRequest.mockImplementation(async (_path, options) => { if (options?.method === 'POST') throw new Error('网络暂时不可用'); return { items: [], total: 0 } })
  render(<GuestbookPage />)
  await type('保留这段文字')
  fireEvent.click(screen.getByRole('button', { name: '提交留言' }))
  await screen.findByRole('alert')
  expect((await editor()).value).toBe('保留这段文字')
  expect(screen.queryByText(notice)).toBeNull()
  await waitFor(() => expect(screen.getByRole('button', { name: '提交留言' }).disabled).toBe(false))
})

it('opens the native Waline image emoji panel, previews safely and submits a shortcode', async () => {
  guestbookRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? { item: { ...pending, markdown: ':weibo_smile:' } } : { items: [], total: 0 })
  const { container } = render(<GuestbookPage />)
  await editor()
  fireEvent.click(screen.getByTitle('表情'))
  const emoji = await screen.findByTitle('weibo_smile')
  expect(emoji.querySelector('img').getAttribute('src')).toBe('/waline-emojis/weibo/weibo_smile.png')
  fireEvent.click(emoji)
  await waitFor(() => expect(screen.getByLabelText('留言内容').value).toBe(':weibo_smile:'))
  fireEvent.click(screen.getByTitle('预览'))
  await waitFor(() => expect(container.querySelector('.wl-preview .wl-emoji')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '提交留言' }))
  await screen.findByText(notice)
  const sent = guestbookRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body
  expect(sent.get('markdown')).toBe(':weibo_smile:')
})

it('sanitizes native Waline previews before inserting HTML into the DOM', async () => {
  guestbookRequest.mockResolvedValue({ items: [], total: 0 })
  const { container } = render(<GuestbookPage />)
  await type('<img src=x onerror="alert(1)"><svg onload="alert(2)"></svg> [bad](javascript:alert(3))')
  fireEvent.click(screen.getByTitle('预览'))
  await act(async () => {})
  expect(container.querySelector('.wl-preview img, .wl-preview svg, .wl-preview script, .wl-preview a[href^="javascript:"]')).toBeNull()
})

it('uses Waline’s upload control and only sends its selected image with the submitted message', async () => {
  const create = URL.createObjectURL; const revoke = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/selected-image')
  URL.revokeObjectURL = vi.fn()
  try {
    guestbookRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? { item: { ...pending, markdown: '' } } : { items: [], total: 0 })
    const { container } = render(<GuestbookPage />)
    await editor()
    const file = new File(['image'], '表情.gif', { type: 'image/gif' })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByLabelText('留言内容').value).toContain('blob:http://localhost/selected-image'))
    expect(guestbookRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
    fireEvent.click(screen.getByTitle('预览'))
    await waitFor(() => expect(container.querySelector('.wl-preview img')?.getAttribute('src')).toBe('blob:http://localhost/selected-image'))
    fireEvent.click(screen.getByRole('button', { name: '提交留言' }))
    await screen.findByText(notice)
    const body = guestbookRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body
    expect(body.get('markdown')).toBe('')
    expect(body.get('kinds')).toBe('["emoji"]')
    expect(body.get('files').name).toBe('表情.gif')
    await waitFor(() => expect(screen.getByLabelText('留言内容').value).toBe(''))
  } finally { cleanup(); URL.createObjectURL = create; URL.revokeObjectURL = revoke }
})

it('keeps sorting and same-sort refresh in the current list UI', async () => {
  guestbookRequest.mockResolvedValue({ items: [], total: 0 })
  render(<GuestbookPage />)
  await screen.findByText('还没有公开留言，来留下第一句话吧。')
  fireEvent.click(screen.getByRole('button', { name: '热度', exact: true }))
  await waitFor(() => expect(guestbookRequest.mock.calls.at(-1)[0]).toContain('sort=hot'))
  await screen.findByText('还没有公开留言，来留下第一句话吧。')
  const before = guestbookRequest.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '热度', exact: true }))
  await waitFor(() => expect(guestbookRequest.mock.calls.length).toBeGreaterThan(before))
  fireEvent.click(screen.getByRole('button', { name: '最新', exact: true }))
  await waitFor(() => expect(guestbookRequest.mock.calls.at(-1)[0]).toContain('sort=latest'))
})

it('puts messages before the composer and dismisses the success toast after four seconds', async () => {
  guestbookRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? { item: pending } : { items: [], total: 0 })
  render(<GuestbookPage />)
  await editor()
  const list = screen.getByRole('region', { name: '留言列表' })
  expect(list.compareDocumentPosition(screen.getByLabelText('留言内容')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await type('一条留言')
  vi.useFakeTimers()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '提交留言' })) })
  expect(screen.getByText(notice)).toBeTruthy()
  act(() => vi.advanceTimersByTime(3999))
  expect(screen.getByText(notice)).toBeTruthy()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByText(notice)).toBeNull()
})
