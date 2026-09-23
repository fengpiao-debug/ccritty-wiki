// 文件作用：校验 B 站 BV/AV 号、视频链接和播放器链接，并把规范化结果回填到视频草稿。
import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import { parseBilibili } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'

export function VideoLinkField({ value, disabled, onParsed }) {
  const [source, setSource] = useState(value.embedUrl || value.bvid || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resolving, setResolving] = useState(false)
  const auth = useAuth()
  useEffect(() => setSource(value.embedUrl || value.bvid || ''), [value.embedUrl, value.bvid])

  async function parse() {
    setError('')
    setNotice('')
    try {
      const result = parseBilibili(source)
      setResolving(true)
      const details = await contentApi.resolveVideo(source)
      onParsed((current) => ({
        ...result,
        title: details.title || current.title || '',
        description: details.description || current.description || '',
        cover: auth.can('image.write') ? details.cover || current.cover || '' : current.cover || '',
      }))
      setNotice(details.title ? `已识别：${details.title}` : `已识别 ${result.bvid}，B 站未返回标题`)
    } catch (cause) {
      setError(cause.message || '无法解析该 B 站视频地址')
    } finally {
      setResolving(false)
    }
  }

  return <div className="full cms-video-link-field">
    <label htmlFor="video-source">B 站视频链接 / BV / AV 号</label>
    <div className="cms-inline-input">
      <input id="video-source" aria-label="B 站视频链接或 BV/AV 号" disabled={disabled || resolving} value={source}
        placeholder="粘贴 B 站视频链接、BV/AV 号或播放器地址"
        onChange={(event) => { setSource(event.target.value); setError(''); setNotice('') }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); parse() } }} />
      <button type="button" className="cms-button" disabled={disabled || resolving || !source.trim()} onClick={parse}><Link2 size={16} />{resolving ? '获取信息中…' : '解析链接'}</button>
    </div>
    {error && <p className="cms-alert error" role="alert">{error}</p>}
    {!error && (notice || value.bvid) && <p className="cms-video-link-result" role="status">{notice || `已识别：${value.bvid}`}</p>}
  </div>
}
