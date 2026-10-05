// 网站公共信息的默认值和保存校验，前后端共用。
export const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteTitle: '歌手cc的wiki',
  faviconUrl: '',
  headerName: '',
  headerSubtitle: 'Artist Archive / Wiki',
  headerLogoUrl: '',
  headerMarkText: '印',
  footerName: '熙影 · 音乐档案',
  footerLogoUrl: '',
  footerMarkText: '印',
  footerTagline: 'ARTIST ARCHIVE',
  footerDescription: '收藏每一段旋律，记录每一次相遇。',
  footerAbout: '一个由音乐爱好者共同整理的小站，收录作品、舞台与影像，让喜欢的声音有迹可循。',
  contactEmail: 'hello@example.com',
  contactNote: '资料补充、内容勘误与交流合作，欢迎来信。',
  copyright: '',
  icpNumber: '',
  icpUrl: 'https://beian.miit.gov.cn/',
  policeNumber: '',
  policeUrl: '',
  aboutTitle: '关于本站',
  aboutMarkdown: '',
  aboutQrCodeUrl: '',
  aboutWeiboUrl: '',
})

const imageSettings = new Set(['faviconUrl', 'headerLogoUrl', 'footerLogoUrl', 'aboutQrCodeUrl'])

export function isSiteImageUrl(value) {
  if (typeof value !== 'string') return false
  const address = value.trim()
  if (!address) return true
  if (/[\\\s\u0000-\u001f\u007f]/u.test(address)) return false
  // 允许同站资源路径；拒绝协议相对地址，避免把 //host 当作本地图片。
  if (address.startsWith('/') && !address.startsWith('//')) return true
  try {
    const url = new URL(address)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}

export function validateSiteSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '网站设置格式不正确'
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_SITE_SETTINGS, key)) return '包含不支持的设置项'
    if (typeof value !== 'string') return '网站设置内容必须是文字'
    const limit = key === 'aboutMarkdown' ? 20000 : key.endsWith('Url') ? 2000 : key.endsWith('MarkText') ? 4 : 200
    if (value.length > limit) return `设置内容过长（最多 ${limit} 字符）`
    if (key === 'contactEmail' && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return '联系邮箱格式不正确'
    if (imageSettings.has(key)) {
      if (!isSiteImageUrl(value)) return '图片地址需填写站内路径或不含账号密码的完整 HTTP / HTTPS 地址'
      continue
    }
    if (key.endsWith('Url') && value.trim()) {
      const label = key === 'aboutWeiboUrl' ? '微博链接' : '备案链接'
      try {
        const url = new URL(value.trim())
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return `${label}需填写不含账号密码的完整 HTTP 或 HTTPS 地址`
      } catch { return `${label}需填写完整的 HTTP 或 HTTPS 地址` }
    }
  }
  return ''
}
