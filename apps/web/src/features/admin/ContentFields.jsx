// 文件作用：按内容类型渲染独立表单字段，统一标签和输入行为，不在列表中嵌入编辑表单。
import { useAuth } from '../auth/AuthContext'
import { ContentUploads } from './ContentUploads'
import { VideoLinkField } from './VideoLinkField'
import { PhotoAlbumFields } from './PhotoAlbumFields'
import { TimelineTagEditor } from './TimelineTagEditor'
import { NewsKindField } from './NewsKindField'
import { VIDEO_CATEGORIES, getTimelineTags } from '@artist-wiki/content-types'
import { toDateTimeInput } from '../../lib/dateTime'

const fields = {
  profile: [['artistName', '歌手名称'], ['subtitle', '副标题'], ['biographyTitle', '首页简介标题', 'text', '锦书（留空使用默认标题）'], ['markdown', '简介（Markdown）', 'textarea']],
  news: [['title', '标题'], ['publishedAt', '日期', 'date'], ['newsKind', '动态标识', 'news-kind'], ['tags', '动态标签', 'tags'], ['sourceName', '来源名称'], ['sourceUrl', '来源链接'], ['markdown', '正文（Markdown）', 'textarea']],
  event: [['title', '活动名称'], ['startsAt', '开始时间（ISO 格式）'], ['city', '城市'], ['venue', '场地'], ['tags', '活动标签', 'tags'], ['ticketUrl', '票务链接'], ['markdown', '活动说明', 'textarea']],
  photo: [['title', '照片名称'], ['url', '图片地址'], ['description', '照片说明', 'textarea']],
  song: [['title', '歌曲名称'], ['artist', '演唱者', 'text', '多个歌手可用 / 分隔，例如：CC / 合唱歌手'], ['album', '专辑'], ['releasedAt', '发行日期', 'date'], ['audioUrl', '音频地址'], ['mvUrl', 'MV 链接（选填）', 'url', '填写 MV 的完整网址；留空时前台按钮置灰'], ['lyrics', '歌词（LRC）', 'textarea'], ['description', '歌曲说明', 'textarea']],
  video: [['title', '视频名称'], ['authorName', '作者 / 摄影 / 剪辑', 'text', '例如：官摄、鱼翅（MV 剪辑）'], ['publishedAt', '拍摄 / 发布时间', 'datetime-local'], ['location', '地点'], ['keywords', '描述关键词', 'text', '例如：舞台、返场、歌词排版'], ['description', '视频简介', 'textarea'], ['markdown', '补充说明（Markdown）', 'textarea']],
}

export function ContentFields({ type, value, onChange, disabled, onBusyChange, uploads = false }) {
  const auth = useAuth()
  const patch = (changes) => onChange?.((current) => ({ ...current, ...(typeof changes === 'function' ? changes(current) : changes) }))
  const imageField = type === 'profile' ? 'heroImage' : type === 'photo' ? 'url' : 'cover'
  const canEditCover = auth.can(type === 'song' ? 'image.song.write' : type === 'video' ? 'image.video.write' : 'image.write')
  if (type === 'photo') return <PhotoAlbumFields value={value} onChange={onChange} disabled={disabled || !canEditCover} uploads={uploads} onBusyChange={onBusyChange} />
  return <>
    {uploads && <ContentUploads type={type} disabled={disabled} onPatch={patch} onBusyChange={onBusyChange} />}
    <div className="cms-form-grid">{type === 'video' && <label className="full">视频大分类<select disabled={disabled} value={value.category || 'other'} onChange={(e) => patch({ category: e.target.value })}>{VIDEO_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}{(fields[type] || []).map(([key, label, inputType = 'text', placeholder]) =>
    inputType === 'news-kind' ? <NewsKindField key={key} value={value[key]} disabled={disabled} onChange={(newsKind) => patch({ newsKind })} /> :
    inputType === 'tags' ? <TimelineTagEditor key={key} label={label} tags={getTimelineTags(value)} pending={value.pendingTag} disabled={disabled} onChange={patch} /> : <label className={inputType === 'textarea' ? 'full' : ''} key={key}>{label}
      {inputType === 'textarea' ? <textarea disabled={disabled} rows={key === 'markdown' ? 10 : 5} value={value[key] || ''} onChange={(e) => patch({ [key]: e.target.value })} /> :
        <input disabled={disabled} required={key === 'title' || key === 'artistName'} type={inputType} placeholder={placeholder} value={inputType === 'datetime-local' ? toDateTimeInput(value[key]) : inputType === 'date' ? (value[key] || '').slice(0, 10) : value[key] || ''} onChange={(e) => patch(type === 'video' && key === 'bvid' ? { bvid: e.target.value, embedUrl: '' } : { [key]: e.target.value })} />}
    </label>)}
    {type === 'video' && <VideoLinkField value={value} disabled={disabled} onParsed={patch} onBusyChange={onBusyChange} />}
    {type !== 'photo' && <label className="full">封面图片地址{!canEditCover && !disabled ? '（需对应图片编辑权限）' : ''}
      <input disabled={disabled || !canEditCover} value={value[imageField] || ''} onChange={(event) => patch({ [imageField]: event.target.value })} /></label>}
    {value[imageField] && <div className="full cms-asset-preview"><img src={value[imageField]} alt="图片预览" /></div>}
    {type === 'song' && value.audioUrl && <div className="full cms-asset-preview"><audio controls preload="none" src={value.audioUrl} aria-label="音频试听" /></div>}
    </div>
  </>
}
