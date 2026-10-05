// 从公共设置展示管理员维护的关于页面。
import { useOutletContext } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Markdown } from './Markdown'
import { PageHeading } from './NewsPage'

export function AboutPage() {
  const { settings, loading, error } = useOutletContext()
  return <div className="content-page about-page">
    <PageHeading title={settings.aboutTitle || '关于本站'} subtitle="About" />
    {loading ? <p className="empty-copy" role="status">正在加载关于信息…</p> :
      error ? <p className="empty-copy" role="alert">关于信息暂时无法加载，请稍后刷新重试。</p> :
      <>
        {settings.aboutMarkdown.trim() ? <Markdown>{settings.aboutMarkdown}</Markdown> :
          !settings.aboutQrCodeUrl && !settings.aboutWeiboUrl && <p className="empty-copy">关于信息尚未填写。</p>}
        {(settings.aboutQrCodeUrl || settings.aboutWeiboUrl) && <section className="about-contact" aria-labelledby="about-contact-title">
          <h2 id="about-contact-title">关注与交流</h2>
          <div className="about-contact-content">
            {settings.aboutQrCodeUrl && <figure className="about-qr-code">
              <a href={settings.aboutQrCodeUrl} target="_blank" rel="noopener noreferrer" aria-label="查看二维码原图">
                <img src={settings.aboutQrCodeUrl} alt="关于页面二维码" loading="lazy" />
              </a>
              <figcaption>扫描二维码 · 点击查看原图</figcaption>
            </figure>}
            {settings.aboutWeiboUrl && <a className="subtle-button about-weibo" href={settings.aboutWeiboUrl} target="_blank" rel="noopener noreferrer">访问微博<ArrowUpRight size={16} /></a>}
          </div>
        </section>}
      </>}
  </div>
}
