import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BatchSongUploadDialog } from './BatchSongUploadDialog'
import { ContentManagementPage } from './ContentManagementPage'
import { uploadFile } from './uploadApi'
import { contentApi } from '../../lib/api'

const access = vi.hoisted(() => ({ write: true, cover: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: (permission) => access.write && (permission === 'music.write' || access.cover && permission === 'image.song.write') }) }))
vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
vi.mock('../../lib/api', () => ({ contentApi: { lock: vi.fn(), unlock: vi.fn(), saveContent: vi.fn(), getAdminContent: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks(); access.write = true; access.cover = false
  contentApi.lock.mockResolvedValue({}); contentApi.unlock.mockResolvedValue({}); contentApi.saveContent.mockResolvedValue({})
  contentApi.getAdminContent.mockResolvedValue({ songs: [] })
})
afterEach(cleanup)
function select(names = ['first.mp3', 'second.mp3']) {
  fireEvent.change(screen.getByLabelText('批量上传歌曲文件', { selector: 'input' }), { target: { files: names.map((name) => new File(['audio'], name)) } })
}

it('imports separate song drafts, preserves edits during upload and saves only after review', async () => {
  let resolveSecond
  uploadFile.mockResolvedValueOnce({ url: '/first.mp3', metadata: { title: '识别歌名', artist: '歌手', album: '专辑', releasedAt: '2026' } })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
  const onSaved = vi.fn(), onClose = vi.fn()
  render(<BatchSongUploadDialog onSaved={onSaved} onClose={onClose} />)
  select()
  await screen.findByLabelText('歌曲 1 歌曲名称')
  fireEvent.change(screen.getByLabelText('歌曲 1 歌曲名称'), { target: { value: '人工修改' } })
  expect(screen.getByRole('button', { name: '等待上传完成…' }).disabled).toBe(true)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => resolveSecond({ url: '/second.mp3' }))
  expect(screen.getByLabelText('歌曲 1 歌曲名称').value).toBe('人工修改')
  expect(screen.getByLabelText('歌曲 2 歌曲名称').value).toBe('second')
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（2）' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2))
  const calls = contentApi.saveContent.mock.calls
  expect(calls[0][2]).toMatchObject({ title: '人工修改', artist: '歌手', album: '专辑', releasedAt: '2026', audioUrl: '/first.mp3' })
  expect(calls[1][2]).toMatchObject({ title: 'second', audioUrl: '/second.mp3' })
  expect(calls[0][1]).not.toBe(calls[1][1])
  expect(contentApi.lock.mock.calls.map(([, id]) => id)).toEqual(calls.map(([, id]) => id))
  expect(screen.getByRole('button', { name: '保存全部歌曲（0）' }).disabled).toBe(true)
})

it('retains failed saves, releases their locks and retries with the same ID without reuploading or resaving successes', async () => {
  uploadFile.mockResolvedValue({ url: '/song.mp3' })
  contentApi.saveContent.mockRejectedValueOnce(new Error('保存失败')).mockResolvedValue({})
  const onSaved = vi.fn()
  render(<BatchSongUploadDialog onSaved={onSaved} onClose={vi.fn()} />)
  select()
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（2）' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（2）' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1))
  expect(screen.getByRole('alert').textContent).toBe('保存失败')
  const firstId = contentApi.saveContent.mock.calls[0][1]
  expect(contentApi.unlock).toHaveBeenCalledWith('song', firstId)
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
  expect(contentApi.saveContent).toHaveBeenCalledTimes(3)
  expect(contentApi.saveContent.mock.calls[2][1]).toBe(firstId)
  expect(uploadFile).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('rejects blank titles and lets the user remove unwanted songs before saving', async () => {
  uploadFile.mockResolvedValue({ url: '/song.mp3' })
  render(<BatchSongUploadDialog onSaved={vi.fn()} onClose={vi.fn()} />)
  select()
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（2）' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '移除歌曲 2' }))
  fireEvent.change(screen.getByLabelText('歌曲 1 歌曲名称'), { target: { value: '  ' } })
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  expect(screen.getByRole('alert').textContent).toContain('请填写歌曲名称')
  expect(contentApi.lock).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('歌曲 1 歌曲名称'), { target: { value: '有效歌名' } })
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  await waitFor(() => expect(contentApi.saveContent).toHaveBeenCalledOnce())
})

it.each([true, false])('only music writers see the batch entry (write=%s)', async (write) => {
  access.write = write
  render(<ContentManagementPage module={{ type: 'song', key: 'songs', scope: 'music', label: '歌曲管理' }} />)
  await screen.findByText('暂无匹配的内容')
  const button = screen.queryByRole('button', { name: '批量上传歌曲' })
  if (write) {
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: '批量上传歌曲' })).toBeTruthy()
  } else expect(button).toBeNull()
})

it('pairs mixed files in any selection order by filename, independently of metadata titles or edits', async () => {
  access.cover = true
  let finishCover
  uploadFile.mockImplementation((file, category) => {
    if (file.name === 'First.PNG') return new Promise((resolve) => { finishCover = resolve })
    if (category === 'audio') return Promise.resolve({ url: `/${file.name}`, metadata: { title: `标签歌名 ${file.name}`, artist: '演唱者' } })
    if (category === 'lyrics') return Promise.resolve({ text: `[00:01.00]${file.name}`, metadata: { title: '不应覆盖的歌词标题', album: '歌词中的专辑' } })
    return Promise.resolve({ url: `/${file.name}` })
  })
  const onSaved = vi.fn()
  render(<BatchSongUploadDialog onSaved={onSaved} onClose={vi.fn()} />)
  select(['First.PNG', 'second.lrc', 'first.mp3', 'second.mp3', 'first.lrc', 'second.jpg'])
  await waitFor(() => expect(finishCover).toBeTypeOf('function'))
  expect(uploadFile.mock.calls.slice(0, 2).map(([, category]) => category)).toEqual(['audio', 'audio'])
  fireEvent.change(screen.getByLabelText('歌曲 1 歌曲名称'), { target: { value: '手动修改标题' } })
  await act(async () => finishCover({ url: '/first-cover.png' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（2）' }).disabled).toBe(false))
  expect(screen.getByRole('img', { name: '歌曲 1 封面预览' }).getAttribute('src')).toBe('/first-cover.png')
  expect(screen.getByLabelText('歌曲 1 歌词').value).toContain('first.lrc')
  expect(screen.getByLabelText('歌曲 2 歌词').value).toContain('second.lrc')
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（2）' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2))
  expect(contentApi.saveContent.mock.calls[0][2]).toMatchObject({ title: '手动修改标题', cover: '/first-cover.png', audioUrl: '/first.mp3', lyrics: '[00:01.00]first.lrc', album: '歌词中的专辑' })
  expect(contentApi.saveContent.mock.calls[1][2]).toMatchObject({ cover: '/second.jpg', audioUrl: '/second.mp3', lyrics: '[00:01.00]second.lrc' })
})

it('keeps orphan lyrics unuploaded and pairs them when the matching audio is added later', async () => {
  uploadFile.mockImplementation((file, category) => Promise.resolve(category === 'lyrics' ? { text: '[00:01.00]歌词' } : { url: '/song.mp3' }))
  render(<BatchSongUploadDialog onSaved={vi.fn()} onClose={vi.fn()} />)
  select(['song.lrc'])
  await screen.findByRole('button', { name: '重试未完成文件（1）' })
  expect(screen.getByRole('alert').textContent).toContain('未找到已导入的同名音频')
  expect(uploadFile).not.toHaveBeenCalled()
  select(['song.mp3'])
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（1）' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  expect(contentApi.saveContent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '重试未完成文件（1）' }))
  await screen.findByLabelText('歌曲 1 歌词')
  expect(uploadFile.mock.calls.map(([, category]) => category)).toEqual(['audio', 'lyrics'])
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  await waitFor(() => expect(contentApi.saveContent).toHaveBeenCalledOnce())
})

it('rejects ambiguous names, and removing the duplicate allows audio and its attachment to retry together', async () => {
  access.cover = true
  uploadFile.mockImplementation((file) => Promise.resolve({ url: `/${file.name}` }))
  render(<BatchSongUploadDialog onSaved={vi.fn()} onClose={vi.fn()} />)
  select(['song.mp3', 'SONG.wav', 'song.png', 'other.mp3'])
  await screen.findByRole('button', { name: '重试未完成文件（3）' })
  expect(uploadFile.mock.calls.map(([file]) => file.name)).toEqual(['other.mp3'])
  expect(screen.getByRole('alert').textContent).toContain('同名音频有多个')
  fireEvent.click(screen.getByRole('button', { name: '移除未完成文件 SONG.wav' }))
  fireEvent.click(screen.getByRole('button', { name: '重试未完成文件（2）' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（2）' }).disabled).toBe(false))
  expect(uploadFile.mock.calls.map(([file]) => file.name)).toEqual(['other.mp3', 'song.mp3', 'song.png'])
  expect(screen.getByRole('img', { name: '歌曲 2 封面预览' }).getAttribute('src')).toBe('/song.png')
  select(['song.jpg'])
  await screen.findByRole('button', { name: '重试未完成文件（1）' })
  expect(screen.getByRole('alert').textContent).toContain('已匹配同名歌曲封面')
  expect(uploadFile).toHaveBeenCalledTimes(3)
})

it('blocks incomplete songs while allowing complete songs to save, then retries only the failed cover', async () => {
  access.cover = true
  uploadFile.mockResolvedValueOnce({ url: '/first.mp3' }).mockResolvedValueOnce({ url: '/second.mp3' })
    .mockRejectedValueOnce(new Error('封面上传失败')).mockResolvedValueOnce({ url: '/first.png' })
  render(<BatchSongUploadDialog onSaved={vi.fn()} onClose={vi.fn()} />)
  select(['first.mp3', 'first.png', 'second.mp3'])
  await screen.findByRole('button', { name: '重试未完成文件（1）' })
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（2）' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '保存全部歌曲（1）' }).disabled).toBe(false))
  expect(contentApi.saveContent).toHaveBeenCalledTimes(1)
  expect(contentApi.saveContent.mock.calls[0][2].audioUrl).toBe('/second.mp3')
  fireEvent.click(screen.getByRole('button', { name: '重试未完成文件（1）' }))
  await screen.findByRole('img', { name: '歌曲 1 封面预览' })
  fireEvent.click(screen.getByRole('button', { name: '保存全部歌曲（1）' }))
  await waitFor(() => expect(contentApi.saveContent).toHaveBeenCalledTimes(2))
  expect(contentApi.saveContent.mock.calls[1][2]).toMatchObject({ audioUrl: '/first.mp3', cover: '/first.png' })
  expect(uploadFile.mock.calls.map(([, category]) => category)).toEqual(['audio', 'audio', 'cover', 'cover'])
})

it('checks cover permissions and the lyrics size limit before uploading without blocking audio', async () => {
  uploadFile.mockResolvedValue({ url: '/song.mp3' })
  render(<BatchSongUploadDialog onSaved={vi.fn()} onClose={vi.fn()} />)
  const input = screen.getByLabelText('批量上传歌曲文件', { selector: 'input' })
  expect(input.accept).toContain('.lrc')
  expect(input.accept).not.toContain('.png')
  const lyrics = new File(['lyrics'], 'song.lrc')
  Object.defineProperty(lyrics, 'size', { value: 1024 * 1024 + 1 })
  fireEvent.change(input, { target: { files: [new File(['audio'], 'song.mp3'), new File(['cover'], 'song.png'), lyrics] } })
  await screen.findByRole('button', { name: '重试未完成文件（2）' })
  expect(uploadFile).toHaveBeenCalledOnce()
  expect(screen.getByRole('alert').textContent).toContain('歌曲封面编辑权限')
  expect(screen.getByRole('alert').textContent).toContain('1MB')
})
