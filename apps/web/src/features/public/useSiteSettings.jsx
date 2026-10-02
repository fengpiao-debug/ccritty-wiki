// 每次进入前台重新获取公共设置，使后台保存后的内容立即可见。
import { useEffect, useState } from 'react'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'

export function useSiteSettings() {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    contentApi.getSiteSettings().then((result) => {
      if (active) setSettings({ ...DEFAULT_SITE_SETTINGS, ...result.settings })
    }).catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { settings, loading, error }
}
