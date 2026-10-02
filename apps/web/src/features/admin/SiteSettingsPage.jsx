// 管理员维护公共页脚和关于页面，独立于编辑者内容管理。
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save } from 'lucide-react'
import { DEFAULT_SITE_SETTINGS, validateSiteSettings } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'

export function SiteSettingsPage() {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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
    if (!draft || loading || saving) return
    const invalid = validateSiteSettings(draft)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await contentApi.saveSiteSettings(draft)
      setDraft({ ...DEFAULT_SITE_SETTINGS, ...result.settings })
      setNotice('网站设置已保存，公共页脚和关于页面已更新。')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  const input = (key, label, placeholder, type = 'text') => <label>{label}
    <input type={type} value={draft?.[key] || ''} placeholder={placeholder} maxLength={type === 'url' ? 2000 : 200}
      onChange={(event) => patch(key, event.target.value)} />
  </label>
  return <>
    <div className="cms-page-heading"><div><h1>网站设置</h1><p>系统管理 / 页脚与关于</p></div></div>
    {loading && <p role="status">正在加载网站设置…</p>}
    {error && <p className="cms-alert error" role="alert">{error}</p>}
    {!loading && !draft && <button type="button" className="cms-button" onClick={reload}>重新加载</button>}
    {notice && <p className="cms-alert success" role="status">{notice}</p>}
    <form className="cms-settings-form" onSubmit={save}>
      <fieldset disabled={loading || saving || !draft}>
        <section className="cms-registry">
          <div className="cms-section-title"><h2>公共页脚</h2></div>
          <div className="cms-dialog-body cms-form-grid">
            <p className="full cms-muted">显示在所有前台页面底部。站点介绍、关于摘要和联系方式可在这里修改；示例邮箱请替换为自己的邮箱。未填写的版权或备案信息不会显示。</p>
            {input('footerName', '页脚站点名称', '例如：熙影 · 音乐档案')}
            {input('footerDescription', '页脚站点简介', '一句话介绍这个网站')}
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
        <div className="cms-settings-actions"><button className="cms-button primary"><Save size={16} />{saving ? '保存中…' : '保存网站设置'}</button>
          <Link to="/about" className="cms-front-link">查看已保存的关于页面</Link>
        </div>
      </fieldset>
    </form>
  </>
}
