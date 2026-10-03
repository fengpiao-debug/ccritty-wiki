// 前后台共用已保存的网站设置，保存后立即更新；切回窗口时重新读取。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'
import { SiteMetadata } from '../../components/SiteMetadata'

const SiteSettingsContext = createContext(null)

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const updateSettings = useCallback((saved) => {
    revision.current += 1
    setSettings({ ...DEFAULT_SITE_SETTINGS, ...saved })
    setLoading(false)
    setError('')
  }, [])
  const reload = useCallback(async () => {
    const current = ++revision.current
    try {
      const result = await contentApi.getSiteSettings()
      if (current === revision.current) {
        setSettings({ ...DEFAULT_SITE_SETTINGS, ...result.settings })
        setError('')
      }
    } catch (err) { if (current === revision.current) setError(err.message) }
    finally { if (current === revision.current) setLoading(false) }
  }, [])
  useEffect(() => {
    reload()
    window.addEventListener('focus', reload)
    return () => { revision.current += 1; window.removeEventListener('focus', reload) }
  }, [reload])
  return <SiteSettingsContext.Provider value={{ settings, loading, error, updateSettings }}>
    <SiteMetadata settings={settings} />
    {children}
  </SiteSettingsContext.Provider>
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext)
  if (!context) throw new Error('网站设置需要 SiteSettingsProvider')
  return context
}
