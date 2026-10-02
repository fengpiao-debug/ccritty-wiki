// 网站公共信息的默认值和保存校验，前后端共用。
export const DEFAULT_SITE_SETTINGS = Object.freeze({
  footerName: '熙影 · 音乐档案',
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
})

export function validateSiteSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '网站设置格式不正确'
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_SITE_SETTINGS, key)) return '包含不支持的设置项'
    if (typeof value !== 'string') return '网站设置内容必须是文字'
    const limit = key === 'aboutMarkdown' ? 20000 : key.endsWith('Url') ? 2000 : 200
    if (value.length > limit) return `设置内容过长（最多 ${limit} 字符）`
    if (key === 'contactEmail' && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return '联系邮箱格式不正确'
    if (key.endsWith('Url') && value.trim()) {
      try {
        const url = new URL(value.trim())
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '备案链接需填写不含账号密码的完整 HTTP 或 HTTPS 地址'
      } catch { return '备案链接需填写完整的 HTTP 或 HTTPS 地址' }
    }
  }
  return ''
}
