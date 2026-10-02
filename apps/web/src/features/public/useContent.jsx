// 文件作用：apps/web/src/features/public/useContent.jsx，负责公开 Wiki 内容展示。
import { useEffect, useState } from 'react'
import { contentApi } from '../../lib/api'
import { demoContent } from '../../data/demoContent'
import { normalizeContent } from '../../utils/content'

let cachedContent = null
let loadingPromise = null

export function useContent() {
  const [content, setContent] = useState(cachedContent || demoContent)
  const [loading, setLoading] = useState(!cachedContent)

  useEffect(() => {
    let active = true
    if (!loadingPromise) {
      loadingPromise = contentApi.getPublic()
        .then((payload) => {
          cachedContent = normalizeContent(payload)
          return cachedContent
        })
        .catch(() => cachedContent || demoContent)
        .finally(() => { loadingPromise = null })
    }
    loadingPromise.then((next) => {
      if (active) { setContent(next); setLoading(false) }
    })
    return () => { active = false }
  }, [])

  return { content, loading }
}
