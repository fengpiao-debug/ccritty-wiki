import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ContentEditorDialog } from './ContentEditorDialog'
import { ContentFields } from './ContentFields'
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

async function edit(type, item = {}) {
  const onSaved = vi.fn()
  render(<ContentEditorDialog item={{ id: type + '-1', title: '测试记录', ...item }} module={{ type, label: '内容管理' }} canWrite onClose={vi.fn()} onSaved={onSaved} />)
  const input = screen.getByRole('textbox', { name: /标签（可添加多个）/ })
  await waitFor(() => expect(input.disabled).toBe(false))
  return { input, onSaved }
}

it('活动可保存为待官宣且日期允许留空，标签与其他信息保留', async () => {
  const { onSaved } = await edit('event', { city: '杭州', tags: ['演出'], startsAt: '' })
  const status = screen.getByRole('combobox', { name: '活动状态' })
  expect(status.value).toBe('')
  fireEvent.change(status, { target: { value: 'pending' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith('event', 'event-1', expect.objectContaining({ status: 'pending', startsAt: '', city: '杭州', tags: ['演出'] }))
})

it('重新编辑待官宣活动可改为即将到来并保存，保留拟定时间', async () => {
  const { onSaved } = await edit('event', { status: 'pending', startsAt: '2026-11-01T19:30:00+08:00' })
  const status = screen.getByRole('combobox', { name: '活动状态' })
  expect(status.value).toBe('pending')
  fireEvent.change(status, { target: { value: 'upcoming' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith('event', 'event-1', expect.objectContaining({ status: 'upcoming', startsAt: '2026-11-01T19:30:00+08:00' }))
})

it.each(['pending', '旧活动状态', ''])('只读活动正确回显状态 %s 并禁止修改', (status) => {
  render(<ContentFields type="event" value={{ status }} disabled />)
  const field = screen.getByRole('combobox', { name: '活动状态' })
  expect(field.value).toBe(status)
  expect(field.disabled).toBe(true)
})

it('动态标识可选择常用项、输入自定义文字，和标签独立保存', async () => {
  const { onSaved } = await edit('news', { tags: ['国风'], sourceName: '官方微博', newsKind: '新歌发布' })
  const input = screen.getByRole('textbox', { name: '动态标识', exact: true })
  expect(input.value).toBe('新歌发布')
  fireEvent.click(screen.getByRole('button', { name: 'MV发布', exact: true }))
  expect(input.value).toBe('MV发布')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '  幕后花絮  ' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith('news', 'news-1', expect.objectContaining({ newsKind: '幕后花絮', tags: ['国风'], sourceName: '官方微博' }))
})

it('动态标识可清空并保存，超长内容不提交', async () => {
  const { onSaved } = await edit('news', { newsKind: '新歌发布' })
  const input = screen.getByRole('textbox', { name: '动态标识', exact: true })
  fireEvent.change(input, { target: { value: '新'.repeat(21) } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  expect(screen.getByRole('alert').textContent).toBe('动态标识最多 20 个字符')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '清除标识' }))
  expect(input.value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith('news', 'news-1', expect.objectContaining({ newsKind: '' }))
})

it('只读动态预览显示标识，编辑和快捷选择均禁用', () => {
  render(<ContentFields type="news" value={{ newsKind: 'MV发布' }} disabled />)
  expect(screen.getByRole('textbox', { name: '动态标识' }).value).toBe('MV发布')
  expect(screen.getByRole('textbox', { name: '动态标识' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '新歌发布' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '清除标识' }).disabled).toBe(true)
})

it.each(['news', 'event'])('%s 可用回车和按钮添加多个标签、去重并删除单个标签', async (type) => {
  const { input, onSaved } = await edit(type, { tags: ['音乐会', '南京'] })
  expect(input.value).toBe('')
  expect(screen.getByRole('button', { name: '删除标签：音乐会' })).toBeTruthy()
  fireEvent.change(input, { target: { value: '音乐会， 国风、现场' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(input.value).toBe('')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '杭州' } })
  fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
  fireEvent.click(screen.getByRole('button', { name: '删除标签：南京' }))
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(contentApi.saveContent).toHaveBeenLastCalledWith(type, type + '-1', expect.objectContaining({ tags: ['音乐会', '国风', '现场', '杭州'] }))
})

it('旧活动类型显示为标签，输入未按添加直接保存也不会丢失', async () => {
  const { input, onSaved } = await edit('event', { category: '拼盘演出', tags: [] })
  expect(screen.queryByRole('textbox', { name: '活动类型' })).toBeNull()
  expect(screen.getByRole('button', { name: '删除标签：拼盘演出' })).toBeTruthy()
  fireEvent.change(input, { target: { value: '南京，国风' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  const payload = contentApi.saveContent.mock.calls[0][2]
  expect(payload.tags).toEqual(['拼盘演出', '南京', '国风'])
  expect(payload).not.toHaveProperty('category')
  expect(payload).not.toHaveProperty('pendingTag')
})

it.each(['news', 'event'])('%s 标签超长或超过数量时阻止添加和保存，修正后可保存', async (type) => {
  const { input, onSaved } = await edit(type)
  for (const [value, message] of [['a'.repeat(41), '每个标签最多 40 个字符'], [Array.from({ length: 21 }, (_, i) => '标签' + i).join('，'), '最多添加 20 个标签']]) {
    fireEvent.change(input, { target: { value } })
    expect(screen.getByRole('alert').textContent).toBe(message)
    expect(screen.getByRole('button', { name: '添加标签' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
    expect(contentApi.saveContent).not.toHaveBeenCalled()
  }
  fireEvent.change(input, { target: { value: '现场' } })
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
})

it('中文输入法确认回车不提前添加标签', async () => {
  const { input } = await edit('event')
  fireEvent.change(input, { target: { value: '国风' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(screen.queryByRole('button', { name: '删除标签：国风' })).toBeNull()
  expect(input.value).toBe('国风')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByRole('button', { name: '删除标签：国风' })).toBeTruthy()
})

it('只读历史版本兼容旧类型字段，输入和删除均禁用', () => {
  render(<ContentFields type="event" value={{ category: '拼盘演出', tags: ['国风'] }} disabled />)
  expect(screen.getByRole('textbox', { name: /活动标签/ }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '删除标签：拼盘演出' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '删除标签：国风' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '添加标签' }).disabled).toBe(true)
})

it.each(['news', 'event'])('%s 可删除全部标签，旧活动类型不会保留在提交内容中', async (type) => {
  const { onSaved } = await edit(type, { tags: ['音乐会'], ...(type === 'event' ? { category: '拼盘演出' } : {}) })
  for (const button of screen.getAllByRole('button', { name: /^删除标签：/ })) fireEvent.click(button)
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(contentApi.saveContent).toHaveBeenCalledWith(type, type + '-1', expect.objectContaining({ tags: [] }))
  expect(contentApi.saveContent.mock.calls[0][2]).not.toHaveProperty('category')
})
