// 同时替换所有 favicon 候选，防止浏览器继续使用旧的固定尺寸图标。
import { useEffect } from 'react'
import { DEFAULT_SITE_SETTINGS, isSiteImageUrl } from '@artist-wiki/content-types'

export function SiteMetadata({ settings }) {
  useEffect(() => {
    document.title = settings.siteTitle || DEFAULT_SITE_SETTINGS.siteTitle
  }, [settings.siteTitle])
  useEffect(() => {
    const url = settings.faviconUrl
    if (!url || !isSiteImageUrl(url)) return
    const originals = Array.from(document.head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]'))
    originals.forEach((link) => link.remove())
    const replacements = ['icon', 'apple-touch-icon'].map((rel) => {
      const link = document.createElement('link')
      link.rel = rel
      link.href = url
      document.head.append(link)
      return link
    })
    return () => {
      replacements.forEach((link) => link.remove())
      originals.forEach((link) => document.head.append(link))
    }
  }, [settings.faviconUrl])
  return null
}
