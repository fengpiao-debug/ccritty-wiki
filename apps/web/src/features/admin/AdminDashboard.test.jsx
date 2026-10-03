// 文件作用：回归管理员与编辑者的后台路由、授权矩阵、账号保存和错误反馈，使用模拟接口避免修改真实数据。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { can, permissionsForUser } from '@artist-wiki/permissions'
import { AdminDashboard } from './AdminDashboard'
import { AdminLayout } from '../../components/AdminLayout'
import { PermissionMatrix } from './PermissionMatrix'
import { contentApi } from '../../lib/api'
import { useState } from 'react'

const fixture = vi.hoisted(() => ({
  user: { id: 'admin', username: 'admin', displayName: '系统管理员', role: 'admin', permissions: ['*'] },
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: fixture.user, loading: false, logout: vi.fn(), can: (permission) => can(permissionsForUser(fixture.user), permission) }),
}))
vi.mock('../../lib/api', () => ({
  contentApi: { users: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), getAdminContent: vi.fn(), getAdminSiteSettings: vi.fn(), imageAssets: vi.fn(), updateImageAsset: vi.fn(), lock: vi.fn(), unlock: vi.fn() },
}))
vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
import { uploadFile } from './uploadApi'
const admin = { id: 'admin', username: 'admin', displayName: '系统管理员', role: 'admin', permissions: ['*'] }
const editor = { id: 'editor-a', username: 'editor-a', displayName: '文字编辑', role: 'editor', permissions: ['text.read', 'text.write'] }
function mount(path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminLayout><AdminDashboard /></AdminLayout>} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  fixture.user = admin
  vi.clearAllMocks()
  contentApi.users.mockResolvedValue({ items: [admin, editor] })
  contentApi.getAdminSiteSettings.mockResolvedValue({ settings: {} })
  contentApi.getAdminContent.mockResolvedValue({ profile: { id: 'profile', artistName: '测试歌手' }, news: [{ id: 'news-1', title: '测试动态' }], events: [] })
  contentApi.createUser.mockResolvedValue({})
  contentApi.updateUser.mockResolvedValue({})
  contentApi.imageAssets.mockResolvedValue({ items: [
    { type: 'song', id: 'song-1', title: '测试歌曲', field: 'cover', label: '歌曲', url: '/old.png' },
  ] })
  contentApi.updateImageAsset.mockResolvedValue({})
  uploadFile.mockResolvedValue({ url: '/uploads/images/new-cover.png' })
})
afterEach(cleanup)

describe('后台职责与交互', () => {
  it('后台歌曲搜索显示命中的歌词片段', async () => {
    fixture.user = { ...editor, permissions: ['music.read'] }
    contentApi.getAdminContent.mockResolvedValue({ songs: [{ id: 'song-1', title: '轮回之境', lyrics: '[00:10]穿越古道海域' }] })
    const { container } = mount('/admin/content/songs')
    await screen.findByText('轮回之境')
    fireEvent.change(screen.getByRole('textbox', { name: '搜索内容' }), { target: { value: '穿越古道海域' } })
    expect(container.querySelector('.lyrics-search-excerpt mark').textContent).toBe('穿越古道海域')
  })
  it('管理员可以进入网站设置，编辑者不能访问设置页面', async () => {
    const view = mount('/admin/settings')
    expect(await screen.findByRole('heading', { name: '网站设置' })).toBeTruthy()
    await waitFor(() => expect(contentApi.getAdminSiteSettings).toHaveBeenCalledTimes(1))
    view.unmount()
    fixture.user = editor
    mount('/admin/settings')
    expect(await screen.findByRole('heading', { name: '歌手简介', exact: true })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '网站设置' })).toBeNull()
    expect(contentApi.getAdminSiteSettings).toHaveBeenCalledTimes(1)
  })
  it('管理员默认进入账号表，不请求内容接口，不显示内容导航', async () => {
    mount()
    expect(await screen.findByRole('heading', { name: '账号与权限', exact: true })).toBeTruthy()
    await screen.findByText('文字编辑')
    expect(contentApi.getAdminContent).not.toHaveBeenCalled()
    const nav = screen.getByRole('navigation', { name: '后台导航' })
    expect(within(nav).queryByRole('link', { name: '动态管理' })).toBeNull()
    expect(within(nav).getByRole('link', { name: '账号与权限' })).toBeTruthy()
  })
  it('管理员手动输入内容路径也回到账号管理', async () => {
    mount('/admin/content/news')
    expect(await screen.findByRole('heading', { name: '账号与权限', exact: true })).toBeTruthy()
    expect(contentApi.getAdminContent).not.toHaveBeenCalled()
  })
  it('文字编辑者仅看到文字栏目，不能进入用户管理', async () => {
    fixture.user = editor
    mount('/admin/users')
    expect(await screen.findByRole('heading', { name: '歌手简介', exact: true })).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: '后台导航' })
    expect(within(nav).queryByRole('link', { name: '账号与权限' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: '歌曲管理' })).toBeNull()
    expect(contentApi.users).not.toHaveBeenCalled()
  })
  it('无权限编辑者进入待授权页', async () => {
    fixture.user = { ...editor, permissions: [] }
    mount()
    expect(await screen.findByRole('heading', { name: '暂无内容权限' })).toBeTruthy()
    expect(contentApi.getAdminContent).not.toHaveBeenCalled()
  })
  it('图片编辑者可进入独立图片工作台并更新歌曲封面', async () => {
  fixture.user = { id: 'image-editor', username: 'image-editor', displayName: '图片编辑', role: 'editor', permissions: ['image.song.read', 'image.song.write'] }
    mount()
    expect(await screen.findByRole('heading', { name: '图片素材', exact: true })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '测试歌曲图片地址' }).value).toBe('/old.png')
    const uploadZone = screen.getByRole('group', { name: '上传测试歌曲图片' })
    fireEvent.drop(uploadZone, { dataTransfer: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } })
    await waitFor(() => expect(contentApi.updateImageAsset).toHaveBeenCalledWith('song', 'song-1', '/uploads/images/new-cover.png'))
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'cover', expect.any(Object))
    expect(contentApi.getAdminContent).not.toHaveBeenCalled()
  })
  it('图片只读账号可以查看素材但不能编辑或上传', async () => {
  fixture.user = { id: 'image-reader', username: 'image-reader', displayName: '图片查看', role: 'editor', permissions: ['image.song.read'] }
    mount('/admin/images')
    await screen.findByRole('heading', { name: '图片素材', exact: true })
    expect(screen.getByText('查看图片')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: '测试歌曲图片地址' })).toBeNull()
    expect(contentApi.updateImageAsset).not.toHaveBeenCalled()
  })
  it('只读编辑者没有新增按钮或编辑按钮', async () => {
    fixture.user = { ...editor, permissions: ['text.read'] }
    mount('/admin/content/news')
    await screen.findByText('测试动态')
    expect(screen.queryByRole('button', { name: '新增内容' })).toBeNull()
    expect(screen.getByRole('button', { name: '查看 测试动态' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '编辑 测试动态' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索内容' }), { target: { value: '动态' } })
    expect(screen.getByText('动态', { selector: 'mark' })).toBeTruthy()
  })
  it('已有账号可修改权限并保存，管理员账号没有编辑入口', async () => {
    mount('/admin/users')
    fireEvent.click(await screen.findByRole('button', { name: '编辑 editor-a 的权限' }))
    expect(screen.queryByRole('button', { name: '编辑 admin 的权限' })).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: '职责预设' }), { target: { value: 'music' } })
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))
    await waitFor(() => expect(contentApi.updateUser).toHaveBeenCalledWith('editor-a', expect.objectContaining({ permissions: ['music.read', 'music.write'] })))
    expect(await screen.findByRole('status')).toBeTruthy()
  })
  it('搜索过滤账号，并在保存失败时保留窗口和错误', async () => {
    mount('/admin/users')
    await screen.findByText('文字编辑')
    fireEvent.change(screen.getByRole('textbox', { name: '搜索账号' }), { target: { value: 'EDITOR' } })
    expect(screen.getByText('editor', { selector: 'mark' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索账号' }), { target: { value: '不存在' } })
    expect(screen.getByText('没有匹配的账号')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索账号' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '编辑 editor-a 的权限' }))
    contentApi.updateUser.mockRejectedValue(new Error('保存失败'))
    fireEvent.click(screen.getByRole('button', { name: '保存账号' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '保存失败')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('权限矩阵自动补齐查看，撤销查看同时撤销编辑', () => {
    function Matrix() {
      const [value, setValue] = useState([])
      return <PermissionMatrix value={value} onChange={setValue} />
    }
    render(<Matrix />)
    fireEvent.click(screen.getByRole('checkbox', { name: '图片编辑' }))
    expect(screen.getByRole('checkbox', { name: '图片查看' }).checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: '图片查看' }))
    expect(screen.getByRole('checkbox', { name: '图片编辑' }).checked).toBe(false)
  })
})
