import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BatchUploadDropzone } from './BatchUploadDropzone'
import { uploadFile } from './uploadApi'

vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)
const file = (name) => new File(['fixture'], name)
const drop = (files) => fireEvent.drop(screen.getByRole('group', { name: '批量上传' }), { dataTransfer: { files } })

it.each(['audio', 'image'])('%s supports multiple selection, validates files separately and retries only failed items', async (category) => {
  const extension = category === 'audio' ? 'mp3' : 'png'
  const onUploaded = vi.fn(), onBusyChange = vi.fn()
  uploadFile.mockResolvedValueOnce({ url: '/first' }).mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce({ url: '/retry' })
  render(<BatchUploadDropzone category={category} label="批量上传" onUploaded={onUploaded} onBusyChange={onBusyChange} />)
  const input = screen.getByLabelText('批量上传', { selector: 'input' })
  expect(input.multiple).toBe(true)
  fireEvent.change(input, { target: { files: [file(`first.${extension}`), file('invalid.exe'), file(`second.${extension}`)] } })
  await waitFor(() => expect(onBusyChange.mock.calls).toEqual([[true], [false]]))
  expect(uploadFile).toHaveBeenCalledTimes(2)
  expect(onUploaded).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('alert').textContent).toContain('invalid.exe')
  fireEvent.click(screen.getByRole('button', { name: '移除未完成文件 invalid.exe' }))
  fireEvent.click(screen.getByRole('button', { name: '重试未完成文件（1）' }))
  await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2))
  expect(uploadFile.mock.calls.map(([item]) => item.name)).toEqual([`first.${extension}`, `second.${extension}`, `second.${extension}`])
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows real progress, cancels the active request and resumes remaining files without duplicating successful ones', async () => {
  const onUploaded = vi.fn(), onBusyChange = vi.fn()
  let progress
  uploadFile.mockResolvedValueOnce({ url: '/first' }).mockImplementationOnce((_file, _category, { signal, onProgress }) => {
    progress = onProgress
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('取消', 'AbortError'))))
  }).mockResolvedValue({ url: '/remaining' })
  render(<BatchUploadDropzone category="audio" label="批量上传" onUploaded={onUploaded} onBusyChange={onBusyChange} />)
  drop(['first.mp3', 'second.mp3', 'third.mp3'].map(file))
  await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2))
  act(() => progress(43))
  expect(screen.getByRole('progressbar', { name: 'second.mp3上传进度' }).value).toBe(43)
  // Repeated drops during a running batch cannot start another upload.
  drop([file('extra.mp3')])
  fireEvent.click(screen.getByRole('button', { name: '取消后续上传' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已取消'))
  expect(onUploaded).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '重试未完成文件（2）' }))
  await waitFor(() => expect(onBusyChange.mock.calls).toEqual([[true], [false], [true], [false]]))
  expect(onUploaded).toHaveBeenCalledTimes(3)
  expect(uploadFile.mock.calls.map(([item]) => item.name)).toEqual(['first.mp3', 'second.mp3', 'second.mp3', 'third.mp3'])
})

it.each([401, 403])('stops the queue on an authorization error (%s)', async (status) => {
  uploadFile.mockRejectedValue(Object.assign(new Error('权限已失效'), { status }))
  render(<BatchUploadDropzone category="image" label="批量上传" onUploaded={vi.fn()} />)
  drop([file('first.png'), file('second.png')])
  await screen.findByRole('button', { name: '重试未完成文件（2）' })
  expect(uploadFile).toHaveBeenCalledOnce()
  expect(screen.getByRole('alert').textContent).toContain('已停止后续上传')
})

it('enforces count, empty-file and per-file size limits and respects disabled state', async () => {
  const props = { category: 'image', label: '批量上传', onUploaded: vi.fn() }
  const view = render(<BatchUploadDropzone {...props} maxFiles={1} />)
  drop([file('first.png'), file('second.png')])
  expect(screen.getByRole('alert').textContent).toContain('最多还能添加 1')
  expect(uploadFile).not.toHaveBeenCalled()
  view.rerender(<BatchUploadDropzone {...props} maxFiles={3} />)
  const oversized = file('large.png')
  Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 })
  drop([new File([], 'empty.png'), oversized])
  await screen.findByRole('button', { name: '重试未完成文件（2）' })
  expect(screen.getByRole('alert').textContent).toContain('文件为空')
  expect(screen.getByRole('alert').textContent).toContain('25MB')
  view.rerender(<BatchUploadDropzone {...props} disabled />)
  drop([file('allowed.png')])
  expect(uploadFile).not.toHaveBeenCalled()
})

it('aborts on unmount and does not fill a removed form', async () => {
  let resolve, signal
  uploadFile.mockImplementation((_file, _category, options) => { signal = options.signal; return new Promise((done) => { resolve = done }) })
  const onUploaded = vi.fn()
  const view = render(<BatchUploadDropzone category="audio" label="批量上传" onUploaded={onUploaded} />)
  drop([file('song.mp3'), file('other.mp3')])
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => resolve({ url: '/late' }))
  expect(onUploaded).not.toHaveBeenCalled()
  expect(uploadFile).toHaveBeenCalledOnce()
})
