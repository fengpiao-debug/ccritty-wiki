import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ContentEditorDialog } from './ContentEditorDialog'
import { contentApi } from '../../lib/api'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }))
vi.mock('../../lib/api', () => ({ contentApi: { lock: vi.fn(), unlock: vi.fn(), saveContent: vi.fn() } }))
vi.mock('./ContentUploads', () => ({ ContentUploads: () => null }))
beforeEach(() => {
  vi.resetAllMocks()
  contentApi.lock.mockResolvedValue({})
  contentApi.unlock.mockResolvedValue({})
  contentApi.saveContent.mockResolvedValue({})
})
afterEach(cleanup)

it.each(['news', 'event'])('%s 编辑标签规范化保存，超长标签阻止提交', async (type) => {
  const onSaved = vi.fn()
  render(<ContentEditorDialog item={{ id: type + '-1', title: '测试记录', tags: ['音乐会', '南京'] }} module={{ type, label: '内容管理' }} canWrite onClose={vi.fn()} onSaved={onSaved} />)
  const input = screen.getByRole('textbox', { name: /^标签/ })
  await waitFor(() => expect(input.disabled).toBe(false))
  expect(input.value).toBe('音乐会，南京')
  fireEvent.change(input, { target: { value: 'a'.repeat(41) } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '每个标签最多 40 个字符')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '音乐会， 南京、现场，音乐会' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(contentApi.saveContent).toHaveBeenLastCalledWith(type, type + '-1', expect.objectContaining({ tags: ['音乐会', '南京', '现场'] }))
})

it('只读模式可以查看标签但不能修改', () => {
  render(<ContentEditorDialog item={{ id: 'news-1', tags: ['音乐会'] }} module={{ type: 'news', label: '动态' }} canWrite={false} onClose={vi.fn()} />)
  expect(screen.getByRole('textbox', { name: /^标签/ }).disabled).toBe(true)
  expect(screen.queryByRole('button', { name: '保存并生成版本' })).toBeNull()
})

it.each(['news', 'event'])('%s 清空标签后保存空列表', async (type) => {
  const onSaved = vi.fn()
  render(<ContentEditorDialog item={{ id: 'tagged', title: '已有记录', tags: ['音乐会'] }} module={{ type, label: '内容管理' }} canWrite onClose={vi.fn()} onSaved={onSaved} />)
  const input = screen.getByRole('textbox', { name: /^标签/ })
  await waitFor(() => expect(input.disabled).toBe(false))
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith(type, 'tagged', expect.objectContaining({ tags: [] }))
})
