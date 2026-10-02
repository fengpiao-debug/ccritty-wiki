import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PhotoAlbumFields } from './PhotoAlbumFields'
import { ContentEditorDialog } from './ContentEditorDialog'
import { ContentManagementPage } from './ContentManagementPage'
import { uploadFile } from './uploadApi'
import { contentApi } from '../../lib/api'

vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
vi.mock('../../lib/api', () => ({ contentApi: { lock: vi.fn(), unlock: vi.fn(), saveContent: vi.fn(), getAdminContent: vi.fn() } }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }))
const module = { type: 'photo', key: 'photos', scope: 'image', label: '图集管理' }
const fixture = { id: 'album', title: '原始标题', images: [{ id: 'a', url: '/uploads/images/a.jpg', keywords: '舞台' }, { id: 'b', url: '/uploads/images/b.jpg', keywords: '红裙' }], coverImageId: 'a' }
beforeEach(() => { vi.clearAllMocks(); contentApi.lock.mockResolvedValue({}); contentApi.unlock.mockResolvedValue({}); contentApi.saveContent.mockResolvedValue({}) })
afterEach(cleanup)
function Fields({ initial = fixture, onBusyChange }) {
  const [value, setValue] = useState(initial)
  return <><PhotoAlbumFields value={value} onChange={setValue} uploads onBusyChange={onBusyChange} /><div data-testid="draft">{JSON.stringify(value)}</div></>
}
const draft = () => JSON.parse(screen.getByTestId('draft').textContent)
const drop = (files) => fireEvent.drop(screen.getByRole('group', { name: '批量上传图集图片' }), { dataTransfer: { files } })

it('chooses, reorders and removes cover photos without losing their keywords', () => {
  render(<Fields />)
  fireEvent.click(within(screen.getByRole('region', { name: '图片 2' })).getByRole('button', { name: '设为封面' }))
  expect(draft().url).toBe('/uploads/images/b.jpg')
  fireEvent.click(screen.getByRole('button', { name: '上移图片 2' }))
  expect(draft().images[0].keywords).toBe('红裙')
  expect(draft().coverImageId).toBe('b')
  fireEvent.click(screen.getByRole('button', { name: '移除图片 1' }))
  expect(draft().coverImageId).toBe('a')
  expect(draft().url).toBe('/uploads/images/a.jpg')
})

it('batch upload retains selection order, successful files and edits made during upload', async () => {
  let resolveFirst
  uploadFile.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    .mockRejectedValueOnce(new Error('上传失败')).mockResolvedValueOnce({ url: '/uploads/images/third.png' })
  const onBusyChange = vi.fn()
  render(<Fields initial={{ title: '原始标题' }} onBusyChange={onBusyChange} />)
  drop(['first.png', 'second.png', 'third.png'].map((name) => new File(['fixture'], name)))
  fireEvent.change(screen.getByLabelText('图集标题'), { target: { value: '上传期间的新标题' } })
  await act(async () => resolveFirst({ url: '/uploads/images/first.png' }))
  await waitFor(() => expect(onBusyChange.mock.calls).toEqual([[true], [false]]))
  expect(draft().title).toBe('上传期间的新标题')
  expect(draft().images.map((image) => image.url)).toEqual(['/uploads/images/first.png', '/uploads/images/third.png'])
  expect(draft().url).toBe('/uploads/images/first.png')
  expect(screen.getByRole('alert').textContent).toContain('second.png：上传失败')
})

it('cancel stops the remaining queue and keeps successful photos', async () => {
  uploadFile.mockResolvedValueOnce({ url: '/uploads/images/first.png' }).mockImplementationOnce((_file, _category, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('取消', 'AbortError')))))
  render(<Fields initial={{ title: '取消测试' }} />)
  drop(['first.png', 'second.png', 'third.png'].map((name) => new File(['fixture'], name)))
  await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: '取消后续上传' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已取消'))
  expect(draft().images).toHaveLength(1)
  expect(uploadFile).toHaveBeenCalledTimes(2)
})

it('requires a photo before saving and sends complete album metadata with the selected cover', async () => {
  const onSaved = vi.fn()
  render(<ContentEditorDialog item={{ id: 'new-album', title: '' }} module={module} canWrite onClose={vi.fn()} onSaved={onSaved} />)
  await screen.findByRole('button', { name: '保存并生成版本' })
  fireEvent.change(screen.getByLabelText('图集标题'), { target: { value: '秋日图集' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  expect(screen.getByRole('alert').textContent).toContain('至少添加一张')
  fireEvent.change(screen.getByLabelText('添加图片地址'), { target: { value: 'https://example.com/a.jpg' } })
  fireEvent.click(screen.getByRole('button', { name: '添加图片' }))
  fireEvent.change(screen.getByLabelText('大分类'), { target: { value: 'portrait' } })
  fireEvent.change(screen.getByLabelText('作者类型'), { target: { value: 'fan' } })
  fireEvent.change(screen.getByLabelText('粉丝 ID（选填）'), { target: { value: 'Fan001' } })
  fireEvent.change(screen.getByLabelText('图片 1 关键词'), { target: { value: '秋日 红裙' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  const saved = contentApi.saveContent.mock.calls[0][2]
  expect(saved).toMatchObject({ title: '秋日图集', category: 'portrait', fanId: 'Fan001', showFanId: false, url: 'https://example.com/a.jpg' })
  expect(saved.images[0].keywords).toBe('秋日 红裙')
  expect(saved.coverImageId).toBe(saved.images[0].id)
})

it('admin search includes private IDs and individual image descriptions', async () => {
  contentApi.getAdminContent.mockResolvedValue({ photos: [{ ...fixture, fanId: 'private009', category: 'event' }, { id: 'old', title: '旧照片', url: '/uploads/images/old.jpg' }] })
  render(<ContentManagementPage module={module} />)
  await screen.findByRole('button', { name: '编辑 原始标题' })
  fireEvent.change(screen.getByLabelText('搜索内容'), { target: { value: 'PRIVATE009 红裙' } })
  expect(screen.getByRole('button', { name: '编辑 原始标题' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '编辑 旧照片' })).toBeNull()
  fireEvent.change(screen.getByLabelText('筛选图集分类'), { target: { value: 'life' } })
  expect(screen.getByText('暂无匹配的内容')).toBeTruthy()
})

it('保存视频的分类、作者、时间、地点、关键词和正文', async () => {
  const onSaved = vi.fn()
  render(<ContentEditorDialog item={{ id: 'video', title: '新视频' }} module={{ type: 'video', key: 'videos', scope: 'video', label: '视频管理' }} canWrite onClose={vi.fn()} onSaved={onSaved} />)
  await screen.findByRole('button', { name: '保存并生成版本' })
  fireEvent.change(screen.getByLabelText('视频大分类'), { target: { value: 'mv' } })
  fireEvent.change(screen.getByLabelText('作者 / 摄影 / 剪辑'), { target: { value: '鱼翅' } })
  fireEvent.change(screen.getByLabelText('拍摄 / 发布时间'), { target: { value: '2026-10-02T19:30' } })
  fireEvent.change(screen.getByLabelText('地点'), { target: { value: '杭州' } })
  fireEvent.change(screen.getByLabelText('描述关键词'), { target: { value: '古风 叙事' } })
  fireEvent.change(screen.getByLabelText('补充说明（Markdown）'), { target: { value: '## 幕后\n剪辑记录' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并生成版本' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(contentApi.saveContent.mock.calls[0][2]).toMatchObject({ category: 'mv', authorName: '鱼翅', location: '杭州', publishedAt: '2026-10-02T19:30', keywords: '古风 叙事', markdown: '## 幕后\n剪辑记录' })
})
