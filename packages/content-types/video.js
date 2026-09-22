// 文件作用：把 BV/AV、B站链接或 iframe 源地址规范化为白名单播放器地址，不执行或保存任意 HTML。
export function parseBilibili(source) {
  let input = String(source || '').trim()
  if (!input || input.length > 8192) throw new Error('请提供有效的 B 站 BV/AV 号、链接或嵌入代码')
  if (/^<iframe\b/i.test(input)) {
    const iframe = input.match(/^<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/iframe>$/is)
    if (!iframe) throw new Error('嵌入代码格式不正确')
    input = iframe[2].replace(/&amp;/g, '&')
  }
  let id = input
  let page = 1
  if (!/^(BV[0-9A-Za-z]{10}|av[1-9]\d*)$/.test(input)) {
    let url
    try { url = new URL(input.startsWith('//') ? `https:${input}` : input) } catch { throw new Error('不是有效的 B 站视频信息') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('视频地址必须来自 B 站')
    if (url.hostname === 'player.bilibili.com' && url.pathname === '/player.html') {
      id = url.searchParams.get('bvid') || `av${url.searchParams.get('aid') || ''}`
      page = Number(url.searchParams.get('page') || 1)
    } else if (['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname)) {
      id = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10}|av[1-9]\d*)\/?$/)?.[1] || ''
      page = Number(url.searchParams.get('p') || 1)
    } else throw new Error('只允许 B 站视频和播放器地址')
  }
  if (!/^(BV[0-9A-Za-z]{10}|av[1-9]\d*)$/.test(id) || !Number.isInteger(page) || page < 1 || page > 10000) throw new Error('视频编号或分 P 信息不正确')
  const query = new URLSearchParams({ [id.startsWith('BV') ? 'bvid' : 'aid']: id.startsWith('BV') ? id : id.slice(2), page: String(page), autoplay: '0' })
  return { bvid: id, embedUrl: `https://player.bilibili.com/player.html?${query}` }
}
