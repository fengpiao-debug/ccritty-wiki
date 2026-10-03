import { useState } from 'react'
import { isSiteImageUrl } from '@artist-wiki/content-types'
import { UploadDropzone } from './UploadDropzone'

export function SiteImageField({ label, category, value, fallback, hint, disabled, onChange, onBusyChange }) {
  const [busy, setBusy] = useState(false)
  const [failedUrl, setFailedUrl] = useState(null)
  const preview = value && isSiteImageUrl(value) ? value : fallback
  return <div className="cms-site-image full">
    <div className="cms-site-image-heading">
      <div className="cms-site-image-preview">
        {preview && preview !== failedUrl ? <img src={preview} alt={`${label}预览`} onError={() => setFailedUrl(preview)} /> : <span>暂无预览</span>}
      </div>
      <div><h3>{label}</h3><p className="cms-muted">{hint}</p></div>
    </div>
    <label>{label}图片地址
      <input value={value || ''} maxLength={2000} disabled={disabled || busy} placeholder="上传图片，或填写 https://… /uploads/…"
        onChange={(event) => { setFailedUrl(null); onChange(event.target.value) }} />
    </label>
    <UploadDropzone category={category} label={`上传${label}`} disabled={disabled}
      onBusyChange={(uploading) => { setBusy(uploading); onBusyChange(uploading) }}
      onUploaded={(result) => { setFailedUrl(null); onChange(result.url) }} />
    {value && <button className="cms-button" type="button" disabled={disabled || busy} onClick={() => onChange('')}>清除{label}</button>}
  </div>
}
