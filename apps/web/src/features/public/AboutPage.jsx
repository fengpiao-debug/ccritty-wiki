// 从公共设置展示管理员维护的关于页面。
import { useOutletContext } from 'react-router-dom'
import { Markdown } from './Markdown'
import { PageHeading } from './NewsPage'

export function AboutPage() {
  const { settings, loading, error } = useOutletContext()
  return <div className="content-page about-page">
    <PageHeading title={settings.aboutTitle || '关于本站'} subtitle="About" />
    {loading ? <p className="empty-copy" role="status">正在加载关于信息…</p> :
      error ? <p className="empty-copy" role="alert">关于信息暂时无法加载，请稍后刷新重试。</p> :
      settings.aboutMarkdown.trim() ? <Markdown>{settings.aboutMarkdown}</Markdown> :
      <p className="empty-copy">关于信息尚未填写。</p>}
  </div>
}
