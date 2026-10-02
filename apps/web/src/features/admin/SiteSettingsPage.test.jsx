// 验证保存回填、故障保留草稿及公共页脚与关于页面展示。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { SiteSettingsPage } from './SiteSettingsPage'
import { PublicFooter } from '../../components/PublicFooter'
import { AboutPage } from '../public/AboutPage'
import { contentApi } from '../../lib/api'

vi.mock('../../lib/api', () => ({ contentApi: { getAdminSiteSettings: vi.fn(), saveSiteSettings: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks()
  contentApi.getAdminSiteSettings.mockResolvedValue({ settings: { ...DEFAULT_SITE_SETTINGS, icpNumber: '旧备案号' } })
  contentApi.saveSiteSettings.mockImplementation(async (settings) => ({ settings }))
})
afterEach(cleanup)
const mount = () => render(<MemoryRouter><SiteSettingsPage /></MemoryRouter>)

describe('网站设置', () => {
  it('回填并保存备案和关于内容，重新进入可读到已保存的值', async () => {
    const view = mount()
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('旧备案号'))
    fireEvent.change(screen.getByLabelText('ICP备案号'), { target: { value: '新备案号' } })
    fireEvent.change(screen.getByLabelText('关于内容（Markdown）'), { target: { value: '## 网站说明' } })
    fireEvent.change(screen.getByLabelText('页脚关于摘要'), { target: { value: '一段简短介绍' } })
    fireEvent.change(screen.getByLabelText('联系邮箱'), { target: { value: 'archive@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    await screen.findByText('网站设置已保存，公共页脚和关于页面已更新。')
    expect(contentApi.saveSiteSettings).toHaveBeenCalledWith(expect.objectContaining({ icpNumber: '新备案号', aboutMarkdown: '## 网站说明', footerAbout: '一段简短介绍', contactEmail: 'archive@example.com' }))
    contentApi.getAdminSiteSettings.mockResolvedValue({ settings: contentApi.saveSiteSettings.mock.calls[0][0] })
    view.unmount(); mount()
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('新备案号'))
  })
  it('保存失败保留输入，加载失败禁止空白覆盖并允许重试', async () => {
    contentApi.getAdminSiteSettings.mockRejectedValueOnce(new Error('无法加载'))
    mount()
    expect((await screen.findByRole('alert')).textContent).toBe('无法加载')
    expect(screen.getByRole('button', { name: '保存网站设置' }).closest('fieldset').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('旧备案号'))
    fireEvent.change(screen.getByLabelText('ICP备案号'), { target: { value: '未保存的备案号' } })
    contentApi.saveSiteSettings.mockRejectedValueOnce(new Error('保存失败'))
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    expect((await screen.findByRole('alert')).textContent).toBe('保存失败')
    expect(screen.getByLabelText('ICP备案号').value).toBe('未保存的备案号')
  })
  it('页脚只显示已填写的备案信息，关于入口可导航到配置正文', async () => {
    const settings = { ...DEFAULT_SITE_SETTINGS, copyright: '© 测试站点', icpNumber: '测试ICP备案号', aboutTitle: '关于我们', aboutMarkdown: '## 网站说明' }
    render(<MemoryRouter><Routes><Route element={<><PublicFooter settings={settings} /><Outlet context={{ settings, loading: false, error: '' }} /></>}>
      <Route path="/" element={<p>首页</p>} /><Route path="/about" element={<AboutPage />} />
    </Route></Routes></MemoryRouter>)
    expect(screen.getByRole('link', { name: '测试ICP备案号' }).getAttribute('href')).toBe(DEFAULT_SITE_SETTINGS.icpUrl)
    expect(screen.getByRole('navigation', { name: '页脚栏目导航' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '音乐作品' }).getAttribute('href')).toBe('/music')
    expect(screen.getByRole('link', { name: 'hello@example.com' }).getAttribute('href')).toBe('mailto:hello%40example.com')
    expect(screen.queryByText('公安备案号')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '了解更多' }))
    expect(await screen.findByRole('heading', { name: '网站说明' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '关于我们', level: 1 })).toBeTruthy()
  })
})
