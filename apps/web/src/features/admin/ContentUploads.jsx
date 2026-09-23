// 文件作用：按账号领域权限组合上传控件，把音频、正文、歌词、图片和B站信息回填到对应内容草稿。
import { parseBilibili } from '@artist-wiki/content-types'
import { useAuth } from '../auth/AuthContext'
import { UploadDropzone } from './UploadDropzone'

export function ContentUploads({ type, disabled, onPatch, onBusyChange }) {
  const auth = useAuth()
  const common = { disabled, onBusyChange }
  const slots = []
  const recognizedSongFields = (result, current) => {
    const metadata = result.metadata || {}
    const recognized = {}
    for (const key of ['title', 'artist', 'album', 'releasedAt']) {
      if (!current[key] && metadata[key]) recognized[key] = metadata[key]
    }
    return recognized
  }
  if (['profile', 'news', 'event'].includes(type) && auth.can('text.write')) {
    slots.push(<UploadDropzone key="text" {...common} category="text" label="拖拽正文文件" onUploaded={(result) => onPatch({ markdown: result.text })} />)
  }
  if (type === 'song' && auth.can('music.write')) {
    slots.push(<UploadDropzone key="audio" {...common} category="audio" label="拖拽音频文件" onUploaded={(result) => onPatch((current) => ({ audioUrl: result.url, ...recognizedSongFields(result, current) }))} />)
    slots.push(<UploadDropzone key="lyrics" {...common} category="lyrics" label="拖拽歌词文件" onUploaded={(result) => onPatch((current) => ({ lyrics: result.text, ...recognizedSongFields(result, current) }))} />)
    slots.push(<UploadDropzone key="cover" {...common} category="cover" label="拖拽歌曲封面" onUploaded={(result) => onPatch({ cover: result.url })} />)
  }
  if (type === 'video' && auth.can('video.write')) {
    slots.push(<UploadDropzone key="video" {...common} category="video" label="拖拽 B 站链接或 TXT 文件"
      onUploaded={(result) => onPatch({ bvid: result.bvid, embedUrl: result.embedUrl })} onTextDrop={(source) => onPatch(parseBilibili(source))} />)
  }
  if (type !== 'song' && auth.can('image.write')) {
    const field = type === 'photo' ? 'url' : type === 'profile' ? 'heroImage' : 'cover'
    slots.push(<UploadDropzone key="image" {...common} category="image" label={type === 'photo' ? '拖拽照片文件' : '拖拽封面图片'} onUploaded={(result) => onPatch({ [field]: result.url })} />)
  }
  return slots.length ? <section className="cms-content-uploads">{slots}</section> : null
}
