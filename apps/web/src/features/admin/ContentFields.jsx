// 文件作用：按内容类型渲染独立表单字段，统一标签和输入行为，不在列表中嵌入编辑表单。
import { useAuth } from '../auth/AuthContext'
import { ContentUploads } from './ContentUploads'

const fields = {
  profile: [['artistName', '歌手名称'], ['subtitle', '副标题'], ['markdown', '简介（Markdown）', 'textarea']],
  news: [['title', '标题'], ['publishedAt', '日期', 'date'], ['sourceName', '来源名称'], ['sourceUrl', '来源链接'], ['markdown', '正文（Markdown）', 'textarea']],
  event: [['title', '活动名称'], ['startsAt', '开始时间（ISO 格式）'], ['city', '城市'], ['venue', '场地'], ['category', '活动类型'], ['ticketUrl', '票务链接'], ['markdown', '活动说明', 'textarea']],
  photo: [['title', '照片名称'], ['url', '图片地址'], ['description', '照片说明', 'textarea']],
  song: [['title', '歌曲名称'], ['artist', '演唱者'], ['album', '专辑'], ['releasedAt', '发行日期', 'date'], ['audioUrl', '音频地址'], ['lyrics', '歌词（LRC）', 'textarea'], ['description', '歌曲说明', 'textarea']],
  video: [['title', '视频名称'], ['bvid', 'BV 号'], ['embedUrl', 'B 站嵌入地址'], ['description', '视频简介', 'textarea']],
}

export function ContentFields({ type, value, onChange, disabled, onBusyChange, uploads = false }) {
  const auth = useAuth()
  const patch = (changes) => onChange?.((current) => ({ ...current, ...(typeof changes === 'function' ? changes(current) : changes) }))
  const imageField = type === 'profile' ? 'heroImage' : type === 'photo' ? 'url' : 'cover'
  const canEditCover = type === 'song' ? auth.can('image.write') || auth.can('music.write') : auth.can('image.write')
  return <>
    {uploads && <ContentUploads type={type} disabled={disabled} onPatch={patch} onBusyChange={onBusyChange} />}
    <div className="cms-form-grid">{(fields[type] || []).map(([key, label, inputType = 'text']) =>
    <label className={inputType === 'textarea' ? 'full' : ''} key={key}>{label}
      {inputType === 'textarea' ? <textarea disabled={disabled} rows={key === 'markdown' ? 10 : 5} value={value[key] || ''} onChange={(e) => patch({ [key]: e.target.value })} /> :
        <input disabled={disabled} required={key === 'title' || key === 'artistName'} type={inputType} value={value[key] || ''} onChange={(e) => patch(type === 'video' && key === 'bvid' ? { bvid: e.target.value, embedUrl: '' } : { [key]: e.target.value })} />}
    </label>)}
    {type !== 'photo' && <label className="full">封面图片地址{!canEditCover && !disabled ? '（需图片编辑权限）' : ''}
      <input disabled={disabled || !canEditCover} value={value[imageField] || ''} onChange={(event) => patch({ [imageField]: event.target.value })} /></label>}
    {value[imageField] && <div className="full cms-asset-preview"><img src={value[imageField]} alt="图片预览" /></div>}
    {type === 'song' && value.audioUrl && <div className="full cms-asset-preview"><audio controls preload="none" src={value.audioUrl} aria-label="音频试听" /></div>}
    </div>
  </>
}
