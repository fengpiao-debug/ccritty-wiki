// 管理员维护网站品牌、浏览器图标、公共页脚和关于页面。
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save } from 'lucide-react'
import { DEFAULT_SITE_SETTINGS, validateSiteSettings } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'
import { useSiteSettings } from '../public/useSiteSettings'
import { SiteImageField } from './SiteImageField'

export function SiteSettingsPage() {
  const { updateSettings } = useSiteSettings()
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedRevision, setSavedRevision] = useState(0)
  const [uploads, setUploads] = useState({})
  const uploading = Object.values(uploads).some(Boolean)
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await contentApi.getAdminSiteSettings()
      setDraft({ ...DEFAULT_SITE_SETTINGS, ...result.settings })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  const patch = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setNotice('') }
  async function save(event) {
    event.preventDefault()
    if (!draft || loading || saving || uploading) return
    const invalid = validateSiteSettings(draft)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await contentApi.saveSiteSettings(draft)
      setDraft({ ...DEFAULT_SITE_SETTINGS, ...result.settings })
      updateSettings(result.settings)
      setSavedRevision((current) => current + 1)
      setNotice('网站设置已保存，网站标题、图标、顶部和页脚已更新。')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  const input = (key, label, placeholder, type = 'text') => <label>{label}
    <input type={type} value={draft?.[key] || ''} placeholder={placeholder} maxLength={type === 'url' ? 2000 : key.endsWith('MarkText') ? 4 : 200}
      onChange={(event) => patch(key, event.target.value)} />
  </label>
  const image = (key, label, category, hint, fallback) => <SiteImageField key={`${key}-${savedRevision}`} label={label} category={category} value={draft?.[key]}
    hint={hint} fallback={fallback} disabled={loading || saving || !draft} onChange={(value) => patch(key, value)}
    onBusyChange={(busy) => setUploads((current) => ({ ...current, [key]: busy }))} />
  return <>
    <div className="cms-page-heading"><div><h1>网站设置</h1><p>系统管理 / 网站品牌、页脚与关于</p></div></div>
    {loading && <p role="status">正在加载网站设置…</p>}
    {error && <p className="cms-alert error" role="alert">{error}</p>}
    {!loading && !draft && <button type="button" className="cms-button" onClick={reload}>重新加载</button>}
    {notice && <p className="cms-alert success" role="status">{notice}</p>}
    <form className="cms-settings-form" onSubmit={save}>
      <fieldset disabled={loading || saving || !draft}>
        <section className="cms-registry">
          <div className="cms-section-title"><h2>浏览器标题与图标</h2></div>
          <div className="cms-dialog-body cms-form-grid">
            <p className="full cms-muted">显示在浏览器标签页。选择图片即可替换图标，上传后点击“保存网站设置”生效。</p>
            {input('siteTitle', '网站标题（浏览器标签页）', '留空使用默认网站标题')}
            {image('faviconUrl', '网站图标（favicon）', 'siteIcon', '图片会自动转为 64 × 64 的 PNG 图标；清除后恢复默认图标。也可填写现成的 ICO 图片地址。', '/favicon-32.png')}
          </div>
        </section>
        <section className="cms-registry">
          <div className="cms-section-title"><h2>顶部品牌</h2></div>
          <div className="cms-dialog-body cms-form-grid">
            <p className="full cms-muted">左上角标识、站点名称和副标题可独立修改。副标题留空隐藏；没有图片时显示印章文字，两项都清空则隐藏标识。</p>
            {input('headerName', '顶部站点名称', '留空沿用歌手名称')}
            {input('headerSubtitle', '顶部副标题', 'Artist Archive / Wiki')}
            {input('headerMarkText', '顶部印章文字', '印（最多 4 个字符）')}
            {image('headerLogoUrl', '顶部标识', 'siteLogo', '替换左上角的“印”图标，图片按比例完整显示。')}
          </div>
        </section>
        <section className="cms-registry">
          <div className="cms-section-title"><h2>公共页脚</h2></div>
          <div className="cms-dialog-body cms-form-grid">
            <p className="full cms-muted">显示在所有前台页面底部。站点介绍、关于摘要和联系方式可在这里修改；示例邮箱请替换为自己的邮箱。未填写的版权或备案信息不会显示。</p>
            {input('footerName', '页脚站点名称', '例如：熙影 · 音乐档案')}
            {input('footerDescription', '页脚站点简介', '一句话介绍这个网站')}
            {input('footerTagline', '页脚小字', 'ARTIST ARCHIVE（留空隐藏）')}
            {input('footerMarkText', '页脚印章文字', '印（最多 4 个字符）')}
            {image('footerLogoUrl', '页脚标识', 'siteLogo', '页脚图标可单独上传；没有图片时显示页脚印章文字，两项都清空则隐藏标识。')}
            <div className="full"><button type="button" className="cms-button" disabled={uploading} onClick={() => { patch('footerLogoUrl', draft.headerLogoUrl); patch('footerMarkText', draft.headerMarkText) }}>复制顶部标识到页脚</button></div>
            <label className="full">页脚关于摘要<textarea rows={3} value={draft?.footerAbout || ''} maxLength={200} onChange={(event) => patch('footerAbout', event.target.value)} /></label>
            {input('contactEmail', '联系邮箱', 'hello@example.com', 'email')}
            {input('contactNote', '联系说明', '资料补充、内容勘误与交流合作，欢迎来信。')}
            {input('copyright', '版权说明', '例如：© 2026 网站名称')}
            {input('icpNumber', 'ICP备案号', '填写实际备案号')}
            {input('icpUrl', 'ICP备案链接', 'https://beian.miit.gov.cn/', 'url')}
            {input('policeNumber', '公安备案号', '填写实际公安备案号')}
            {input('policeUrl', '公安备案链接', '填写备案查询页面的完整链接', 'url')}
          </div>
        </section>
        <section className="cms-registry">
          <div className="cms-section-title"><h2>关于页面</h2></div>
          <div className="cms-dialog-body cms-form-grid">
            <p className="full cms-muted">访客可从公共页脚进入关于页面。</p>
            {input('aboutTitle', '关于标题', '关于本站（留空使用默认标题）')}
            <label className="full">关于内容（Markdown）
              <textarea rows={12} value={draft?.aboutMarkdown || ''} maxLength={20000}
                placeholder="介绍网站、整理缘由、联系方式等，支持 Markdown 格式。"
                onChange={(event) => patch('aboutMarkdown', event.target.value)} />
            </label>
          </div>
        </section>
        <div className="cms-settings-actions"><button className="cms-button primary" disabled={uploading}><Save size={16} />{saving ? '保存中…' : uploading ? '图片上传中…' : '保存网站设置'}</button>
          <Link to="/" className="cms-front-link">查看已保存的网站</Link>
          <Link to="/about" className="cms-front-link">查看已保存的关于页面</Link>
        </div>
      </fieldset>
    </form>
  </>
}
