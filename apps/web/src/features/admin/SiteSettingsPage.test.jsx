// 验证保存回填、故障保留草稿及公共页脚与关于页面展示。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { SiteSettingsPage } from './SiteSettingsPage'
import { PublicFooter } from '../../components/PublicFooter'
import { AboutPage } from '../public/AboutPage'
import { contentApi } from '../../lib/api'
import { SiteSettingsProvider } from '../public/useSiteSettings'
import { uploadFile } from './uploadApi'

vi.mock('../../lib/api', () => ({ contentApi: { getSiteSettings: vi.fn(), getAdminSiteSettings: vi.fn(), saveSiteSettings: vi.fn() } }))
vi.mock('./uploadApi', () => ({ uploadFile: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  contentApi.getSiteSettings.mockResolvedValue({ settings: DEFAULT_SITE_SETTINGS })
  contentApi.getAdminSiteSettings.mockResolvedValue({ settings: { ...DEFAULT_SITE_SETTINGS, icpNumber: '旧备案号' } })
  contentApi.saveSiteSettings.mockImplementation(async (settings) => ({ settings }))
})
afterEach(cleanup)
const mount = () => render(<MemoryRouter><SiteSettingsProvider><SiteSettingsPage /></SiteSettingsProvider></MemoryRouter>)

describe('网站设置', () => {
  it('回填并保存备案和关于内容，重新进入可读到已保存的值', async () => {
    const view = mount()
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('旧备案号'))
    fireEvent.change(screen.getByLabelText('ICP备案号'), { target: { value: '新备案号' } })
    fireEvent.change(screen.getByLabelText('关于内容（Markdown）'), { target: { value: '## 网站说明' } })
    fireEvent.change(screen.getByLabelText('页脚关于摘要'), { target: { value: '一段简短介绍' } })
    fireEvent.change(screen.getByLabelText('联系邮箱'), { target: { value: 'archive@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    await screen.findByText('网站设置已保存，网站标题、图标、顶部和页脚已更新。')
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
    expect(screen.getByRole('link', { name: '视频作品' }).getAttribute('href')).toBe('/videos')
    expect(screen.getByRole('link', { name: 'hello@example.com' }).getAttribute('href')).toBe('mailto:hello%40example.com')
    expect(screen.queryByText('公安备案号')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '了解更多' }))
    expect(await screen.findByRole('heading', { name: '网站说明' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '关于我们', level: 1 })).toBeTruthy()
  })
  it('保存独立品牌设置并立即更新标签页，上传完成前禁止保存，清除后可重新保存', async () => {
    let finishUpload
    uploadFile.mockImplementationOnce(() => new Promise((resolve) => { finishUpload = resolve }))
    mount()
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('旧备案号'))
    fireEvent.change(screen.getByLabelText('网站标题（浏览器标签页）'), { target: { value: '自定义音乐档案' } })
    fireEvent.change(screen.getByLabelText('顶部站点名称'), { target: { value: '顶部名字' } })
    fireEvent.change(screen.getByLabelText('顶部副标题'), { target: { value: 'My Archive' } })
    fireEvent.change(screen.getByLabelText('顶部印章文字'), { target: { value: '影' } })
    fireEvent.change(screen.getByLabelText('顶部标识图片地址'), { target: { value: '/uploads/images/header.png' } })
    fireEvent.click(screen.getByRole('button', { name: '复制顶部标识到页脚' }))
    expect(screen.getByLabelText('页脚标识图片地址').value).toBe('/uploads/images/header.png')
    expect(screen.getByLabelText('页脚印章文字').value).toBe('影')
    fireEvent.change(screen.getByLabelText('页脚标识图片地址'), { target: { value: '/uploads/images/footer.png' } })
    fireEvent.change(screen.getByLabelText('页脚小字'), { target: { value: '我们的音乐收藏' } })
    const file = new File(['png'], 'icon.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传网站图标（favicon）', { selector: 'input' }), { target: { files: [file] } })
    expect(screen.getByRole('button', { name: '图片上传中…' }).disabled).toBe(true)
    expect(uploadFile).toHaveBeenCalledWith(file, 'siteIcon', expect.any(Object))
    finishUpload({ url: '/uploads/images/favicon.png' })
    await waitFor(() => expect(screen.getByLabelText('网站图标（favicon）图片地址').value).toBe('/uploads/images/favicon.png'))
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    await screen.findByText('网站设置已保存，网站标题、图标、顶部和页脚已更新。')
    expect(document.title).toBe('自定义音乐档案')
    expect(document.head.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/uploads/images/favicon.png')
    expect(contentApi.saveSiteSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      siteTitle: '自定义音乐档案', headerName: '顶部名字', headerSubtitle: 'My Archive', headerMarkText: '影',
      headerLogoUrl: '/uploads/images/header.png', footerLogoUrl: '/uploads/images/footer.png', footerTagline: '我们的音乐收藏',
    }))
    fireEvent.click(screen.getByRole('button', { name: '清除网站图标（favicon）' }))
    fireEvent.change(screen.getByLabelText('顶部副标题'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('页脚小字'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    await waitFor(() => expect(contentApi.saveSiteSettings).toHaveBeenLastCalledWith(expect.objectContaining({ faviconUrl: '', headerSubtitle: '', footerTagline: '' })))
  })
  it('上传失败保留原图片，禁止保存不安全图片地址', async () => {
    uploadFile.mockRejectedValueOnce(new Error('图片无法安全解码'))
    mount()
    await waitFor(() => expect(screen.getByLabelText('ICP备案号').value).toBe('旧备案号'))
    fireEvent.change(screen.getByLabelText('顶部标识图片地址'), { target: { value: '/old.png' } })
    fireEvent.change(screen.getByLabelText('上传顶部标识', { selector: 'input' }), { target: { files: [new File(['bad'], 'bad.png', { type: 'image/png' })] } })
    expect((await screen.findByRole('alert')).textContent).toBe('图片无法安全解码')
    expect(screen.getByLabelText('顶部标识图片地址').value).toBe('/old.png')
    fireEvent.change(screen.getByLabelText('顶部标识图片地址'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网站设置' }))
    expect(contentApi.saveSiteSettings).not.toHaveBeenCalled()
    expect(screen.getByText('图片地址需填写站内路径或不含账号密码的完整 HTTP / HTTPS 地址')).toBeTruthy()
  })
})
