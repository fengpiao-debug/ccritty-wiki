// 文件作用：验证拖拽/选择上传、权限可见性、错误重试、取消和异步回填，不向真实后端发送文件。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { UploadDropzone } from './UploadDropzone'
import { ContentFields } from './ContentFields'
import { uploadFile } from './uploadApi'
import { can, permissionsForUser } from '@artist-wiki/permissions'

const fixture = vi.hoisted(() => ({ user: { role: 'editor', permissions: ['music.read', 'music.write'] } }))
const videoApi = vi.hoisted(() => ({ resolveVideo: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: (permission) => can(permissionsForUser(fixture.user), permission) }) }))
vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
vi.mock('../../lib/api', () => ({ contentApi: videoApi }))
const audio = () => new File(['audio fixture'], 'song.mp3', { type: 'audio/mpeg' })
const drop = (label, files) => fireEvent.drop(screen.getByRole('group', { name: label }), { dataTransfer: { files, getData: () => '' } })
beforeEach(() => {
  vi.clearAllMocks()
  fixture.user = { role: 'editor', permissions: ['music.read', 'music.write'] }
  videoApi.resolveVideo.mockResolvedValue({
    bvid: 'BV1xx411c7mD', embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1&autoplay=0',
    title: 'B 站识别标题', description: 'B 站识别简介', cover: 'https://i.example/cover.jpg',
  })
})
afterEach(cleanup)

describe('拖拽上传', () => {
  it('拖入单文件调用 multipart 客户端，成功回填结果', async () => {
    const onUploaded = vi.fn(), onBusyChange = vi.fn()
    uploadFile.mockResolvedValue({ url: '/uploads/audio/song.mp3' })
    render(<UploadDropzone category="audio" label="音频" onUploaded={onUploaded} onBusyChange={onBusyChange} />)
    drop('音频', [audio()])
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ url: '/uploads/audio/song.mp3' }))
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'audio', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(onBusyChange.mock.calls).toEqual([[true], [false]])
  })
  it('文件选择器同样支持上传', async () => {
    uploadFile.mockResolvedValue({ text: '# 正文' })
    const onUploaded = vi.fn()
    render(<UploadDropzone category="text" label="正文" onUploaded={onUploaded} />)
    fireEvent.change(screen.getByLabelText('正文', { selector: 'input' }), { target: { files: [new File(['# 正文'], 'intro.md', { type: 'text/markdown' })] } })
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ text: '# 正文' }))
  })
  it('双扩展名和多文件在发出请求前即被拒绝', () => {
    render(<UploadDropzone category="image" label="图片" onUploaded={vi.fn()} />)
    drop('图片', [new File(['x'], '1.jpg.exe', { type: 'image/jpeg' })])
    expect(screen.getByRole('alert').textContent).toContain('双重扩展名')
    drop('图片', [new File(['x'], '1.png'), new File(['y'], '2.png')])
    expect(screen.getByRole('alert').textContent).toContain('每次只能')
    expect(uploadFile).not.toHaveBeenCalled()
  })
  it('失败保留错误，允许重试同名文件', async () => {
    uploadFile.mockRejectedValueOnce(new Error('缺少上传权限：music.write')).mockResolvedValueOnce({ url: '/retry.mp3' })
    render(<UploadDropzone category="audio" label="音频" onUploaded={vi.fn()} />)
    drop('音频', [audio()])
    expect((await screen.findByRole('alert')).textContent).toContain('缺少上传权限')
    drop('音频', [audio()])
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('尚未保存'))
    expect(uploadFile).toHaveBeenCalledTimes(2)
  })
  it('取消会中止请求，禁用状态不能触发上传', async () => {
    uploadFile.mockImplementation((_file, _category, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))))
    const view = render(<UploadDropzone category="audio" label="音频" onUploaded={vi.fn()} />)
    drop('音频', [audio()])
    fireEvent.click(screen.getByRole('button', { name: '取消音频' }))
    expect((await screen.findByRole('alert')).textContent).toContain('已取消')
    view.rerender(<UploadDropzone category="audio" label="音频" disabled onUploaded={vi.fn()} />)
    drop('音频', [audio()])
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })
  it('上传期间的其他输入不会被异步回填覆盖', async () => {
    let resolve
    uploadFile.mockImplementation(() => new Promise((done) => { resolve = done }))
    function Fields() {
      const [value, setValue] = useState({ title: '原始标题' })
      return <ContentFields type="song" value={value} onChange={setValue} uploads />
    }
    render(<Fields />)
    drop('拖拽音频文件', [audio()])
    fireEvent.change(screen.getByRole('textbox', { name: '歌曲名称' }), { target: { value: '上传时修改的标题' } })
    await act(async () => resolve({ url: '/uploads/audio/test.mp3' }))
    expect(screen.getByRole('textbox', { name: '歌曲名称' }).value).toBe('上传时修改的标题')
    expect(screen.getByRole('textbox', { name: '音频地址' }).value).toBe('/uploads/audio/test.mp3')
  })
  it('音乐编辑者可上传音频、歌词和歌曲封面，其他图片权限单独授权', () => {
    const view = render(<ContentFields type="song" value={{}} onChange={vi.fn()} uploads />)
    expect(screen.getByRole('group', { name: '拖拽音频文件' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '拖拽歌词文件' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: '拖拽歌曲封面' })).toBeNull()
    fixture.user.permissions.push('image.song.write')
    view.rerender(<ContentFields type="song" value={{}} onChange={vi.fn()} uploads />)
    expect(screen.getByRole('group', { name: '拖拽歌曲封面' })).toBeTruthy()
  })
  it('图片编辑者可以改封面但不会获得音乐编辑入口', () => {
    fixture.user = { role: 'editor', permissions: ['image.song.read', 'image.song.write'] }
    render(<ContentFields type="song" value={{ cover: '/uploads/images/old.png' }} onChange={vi.fn()} uploads />)
    expect(screen.getByRole('group', { name: '拖拽歌曲封面' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: '拖拽音频文件' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '封面图片地址' }).disabled).toBe(false)
    expect(screen.queryByRole('group', { name: '拖拽歌词文件' })).toBeNull()
  })
  it('只读或管理员不显示上传入口', () => {
    fixture.user = { role: 'editor', permissions: ['music.read'] }
    const view = render(<ContentFields type="song" value={{}} onChange={vi.fn()} uploads disabled />)
    expect(screen.queryByRole('group')).toBeNull()
    fixture.user = { role: 'admin', permissions: ['*'] }
    view.rerender(<ContentFields type="song" value={{}} onChange={vi.fn()} uploads />)
    expect(screen.queryByRole('group')).toBeNull()
  })
  it('B站解析会请求元数据并回填标题简介，同时拒绝外站链接和本地视频', async () => {
    fixture.user = { role: 'editor', permissions: ['video.write'] }
    function Fields() {
      const [value, setValue] = useState({})
      return <ContentFields type="video" value={value} onChange={setValue} uploads />
    }
    render(<Fields />)
    const group = screen.getByRole('group', { name: '拖拽 B 站链接或 TXT 文件' })
    fireEvent.change(screen.getByRole('textbox', { name: 'B 站视频链接或 BV/AV 号' }), { target: { value: 'BV1xx411c7mD' } })
    fireEvent.click(screen.getByRole('button', { name: '解析链接' }))
    await waitFor(() => expect(videoApi.resolveVideo).toHaveBeenCalledWith('BV1xx411c7mD'))
    await waitFor(() => expect(screen.getByRole('textbox', { name: '视频名称' }).value).toBe('B 站识别标题'))
    expect(screen.getByRole('textbox', { name: '视频简介' }).value).toBe('B 站识别简介')
    expect(screen.getByRole('textbox', { name: /封面图片地址/ }).value).toBe('')
    fireEvent.change(screen.getByRole('textbox', { name: 'B 站视频链接或 BV/AV 号' }), { target: { value: 'https://evil.test/video/BV1xx411c7mD' } })
    fireEvent.click(screen.getByRole('button', { name: '解析链接' }))
    expect(screen.getByRole('alert').textContent).toContain('只允许 B 站')
    fireEvent.drop(group, { dataTransfer: { files: [], getData: () => 'https://www.bilibili.com/video/BV1xx411c7mD/' } })
    await waitFor(() => expect(videoApi.resolveVideo).toHaveBeenLastCalledWith('https://www.bilibili.com/video/BV1xx411c7mD/'))
    await waitFor(() => expect(within(group).getByRole('status').textContent).toContain('已导入表单'))
    fireEvent.drop(group, { dataTransfer: { files: [], getData: () => 'https://evil.test/video/BV1xx411c7mD/' } })
    await waitFor(() => expect(within(group).getByRole('alert').textContent).toContain('只允许 B 站'))
    drop('拖拽 B 站链接或 TXT 文件', [new File(['v'], 'movie.mp4', { type: 'video/mp4' })])
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('导入 B 站 TXT 文件也会请求并回填视频名称', async () => {
    fixture.user = { role: 'editor', permissions: ['video.write'] }
    uploadFile.mockResolvedValue({ bvid: 'BV1xx411c7mD', embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD' })
    function Fields() {
      const [value, setValue] = useState({})
      return <ContentFields type="video" value={value} onChange={setValue} uploads />
    }
    render(<Fields />)
    drop('拖拽 B 站链接或 TXT 文件', [new File(['BV1xx411c7mD'], 'video.txt', { type: 'text/plain' })])
    await waitFor(() => expect(videoApi.resolveVideo).toHaveBeenCalledWith(expect.stringContaining('BV1xx411c7mD')))
    await waitFor(() => expect(screen.getByRole('textbox', { name: '视频名称' }).value).toBe('B 站识别标题'))
    expect(within(screen.getByRole('group', { name: '拖拽 B 站链接或 TXT 文件' })).getByRole('status').textContent).toContain('已导入表单')
  })
})
