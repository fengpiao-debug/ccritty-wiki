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
  contentApi: { users: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), getAdminContent: vi.fn(), lock: vi.fn(), unlock: vi.fn() },
}))
const admin = { id: 'admin', username: 'admin', displayName: '系统管理员', role: 'admin', permissions: ['*'] }
const editor = { id: 'editor-a', username: 'editor-a', displayName: '文字编辑', role: 'editor', permissions: ['text.read', 'text.write'] }
function mount(path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminLayout><AdminDashboard /></AdminLayout>} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  fixture.user = admin
  vi.clearAllMocks()
  contentApi.users.mockResolvedValue({ items: [admin, editor] })
  contentApi.getAdminContent.mockResolvedValue({ profile: { id: 'profile', artistName: '测试歌手' }, news: [{ id: 'news-1', title: '测试动态' }], events: [] })
  contentApi.createUser.mockResolvedValue({})
  contentApi.updateUser.mockResolvedValue({})
})
afterEach(cleanup)

describe('后台职责与交互', () => {
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
  it('只读编辑者没有新增按钮或编辑按钮', async () => {
    fixture.user = { ...editor, permissions: ['text.read'] }
    mount('/admin/content/news')
    await screen.findByText('测试动态')
    expect(screen.queryByRole('button', { name: '新增内容' })).toBeNull()
    expect(screen.getByRole('button', { name: '查看 测试动态' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '编辑 测试动态' })).toBeNull()
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
