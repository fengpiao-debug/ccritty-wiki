// 顶部与页脚共用标识；图片加载失败时仍可显示配置的印章文字。
import { useState } from 'react'
import { isSiteImageUrl } from '@artist-wiki/content-types'

export function BrandMark({ src, text }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const imageUrl = src && isSiteImageUrl(src) && failedUrl !== src ? src : ''
  if (!imageUrl && !text) return null
  return <span className={`brand-mark${imageUrl ? ' brand-mark-image' : ''}`} aria-hidden="true">
    {imageUrl ? <img src={imageUrl} alt="" onError={() => setFailedUrl(src)} /> : text}
  </span>
}
