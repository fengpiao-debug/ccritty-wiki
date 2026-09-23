// 文件作用：让图片编辑者跨内容类型维护封面和照片，不需要歌曲、文字或视频编辑权限。
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { contentApi } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { UploadDropzone } from './UploadDropzone'

const contentTypeLabels = { profile: '歌手简介', news: '动态', event: '活动', photo: '照片', song: '歌曲', video: '视频' }

function ImageAssetRow({ asset, editable, onSaved, onError }) {
  const [url, setUrl] = useState(asset.url)
  const [saving, setSaving] = useState(false)
  const changed = url !== asset.url

  useEffect(() => setUrl(asset.url), [asset.url])

  async function save(nextUrl = url) {
    setSaving(true)
    try {
      await contentApi.updateImageAsset(asset.type, asset.id, nextUrl)
      setUrl(nextUrl)
      onSaved()
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <tr>
    <td><strong>{asset.title}</strong><small>{contentTypeLabels[asset.type]} · {asset.field}</small></td>
    <td>
      {editable ? <div className="cms-image-asset-editor">
        <input aria-label={`${asset.title}图片地址`} value={url} disabled={saving}
          placeholder="粘贴图片 URL，或从右侧上传" onChange={(event) => setUrl(event.target.value)} />
        <button className="cms-icon" type="button" title="保存图片地址" aria-label={`保存 ${asset.title} 图片地址`} disabled={!changed || saving} onClick={() => save()}><Save size={16} /></button>
        <UploadDropzone category={asset.type === 'song' ? 'cover' : asset.type === 'video' ? 'videoCover' : 'image'} label={`上传${asset.title}图片`} disabled={saving}
          onUploaded={(result) => save(result.url)} />
      </div> : asset.url ? <a href={asset.url} target="_blank" rel="noreferrer">查看图片</a> : <span className="cms-muted">未设置</span>}
    </td>
    <td>{asset.url ? <img className="cms-image-asset-preview" src={asset.url} alt={`${asset.title}预览`} loading="lazy" /> : <span className="cms-muted">暂无图片</span>}</td>
  </tr>
}

export function ImageAssetManagementPage() {
  const auth = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setItems((await contentApi.imageAssets()).items) }
    catch (cause) { setError(cause.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  return <>
    <div className="cms-page-heading">
      <div><h1>图片素材</h1><p>内容管理 / 图片素材</p></div>
      <button className="cms-icon" title="刷新图片素材" aria-label="刷新图片素材" disabled={loading} onClick={reload}><RefreshCw size={17} /></button>
    </div>
    {error && <p className="cms-alert error" role="alert">{error}</p>}
    {notice && <p className="cms-alert success" role="status">{notice}</p>}
    <section className="cms-registry">
      <div className="cms-section-title"><h2>图片位置 <span>{items.length}</span></h2><span className="cms-badge green">按图片类型授权</span></div>
      <div className="cms-table-scroll"><table className="cms-table cms-image-asset-table">
        <thead><tr><th>内容</th><th>图片资源</th><th>预览</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={3} className="cms-table-empty">正在加载图片位置…</td></tr>}
          {!loading && items.map((asset) => <ImageAssetRow key={`${asset.type}:${asset.id}`} asset={asset} editable={auth.can(asset.type === 'song' ? 'image.song.write' : asset.type === 'video' ? 'image.video.write' : 'image.write')}
            onSaved={() => { setNotice('图片已保存，历史版本已生成'); setError(''); reload() }} onError={(message) => { setError(message); setNotice('') }} />)}
          {!loading && !items.length && <tr><td colSpan={3} className="cms-table-empty">暂无可维护的图片位置</td></tr>}
        </tbody>
      </table></div>
    </section>
  </>
}
