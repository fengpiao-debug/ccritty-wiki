// 同名音频、封面与歌词自动配对，核对后逐首保存并保留失败项供重试。
import { useEffect, useRef, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { createId, UPLOAD_TYPES } from '@artist-wiki/content-types'
import { contentApi } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { AdminDialog } from './AdminDialog'
import { BatchUploadDropzone } from './BatchUploadDropzone'
import { orderSongFiles, songFileCategory, songFileKey, validateSongFile } from './songUploadMatching'

const MAX_SONGS = 100
export function BatchSongUploadDialog({ onClose, onSaved }) {
  const canUploadCover = useAuth().can('image.song.write')
  const [songs, setSongs] = useState([])
  const songsRef = useRef([])
  const queueRef = useRef([])
  const [queue, setQueue] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const pending = songs.filter((song) => song.phase !== 'saved')
  const savedCount = songs.length - pending.length
  function updateSongs(update) {
    const next = update(songsRef.current)
    songsRef.current = next
    if (mounted.current) setSongs(next)
  }
  function patch(id, changes) {
    updateSongs((current) => current.map((song) => song.id === id ? { ...song, ...changes } : song))
  }
  function imported(result, file) {
    const category = songFileCategory(file)
    const fileKey = songFileKey(file.name)
    const metadata = result.metadata || {}
    if (category === 'audio') {
      const song = {
        id: createId('song'), filename: file.name, fileKey, sources: { audio: file.name }, phase: 'ready', error: '',
        draft: { title: metadata.title || file.name.replace(/\.[^.]+$/, ''), artist: metadata.artist || '', album: metadata.album || '', releasedAt: metadata.releasedAt || '', audioUrl: result.url },
      }
      updateSongs((current) => [...current, song])
    } else {
      updateSongs((current) => current.map((song) => {
        if (song.fileKey !== fileKey) return song
        const draft = { ...song.draft, ...(category === 'cover' ? { cover: result.url } : { lyrics: result.text }) }
        if (category === 'lyrics') {
          for (const key of ['title', 'artist', 'album', 'releasedAt']) if (!draft[key] && metadata[key]) draft[key] = metadata[key]
        }
        return { ...song, phase: 'ready', error: '', draft, sources: { ...song.sources, [category]: file.name } }
      }))
    }
  }
  async function save() {
    if (running.current || uploading || !pending.length) return
    running.current = true; setSaving(true)
    let completed = 0
    try {
      for (const song of pending) {
        if (!mounted.current) break
        if (queueRef.current.some((entry) => songFileKey(entry.name) === song.fileKey && entry.phase !== 'success')) {
          patch(song.id, { phase: 'error', error: '仍有同名文件未完成，请重试或移除未完成文件后保存' }); continue
        }
        if (!song.draft.title.trim()) { patch(song.id, { phase: 'error', error: '请填写歌曲名称' }); continue }
        let locked = false
        patch(song.id, { phase: 'saving', error: '' })
        try {
          await contentApi.lock('song', song.id); locked = true
          if (!mounted.current) break
          await contentApi.saveContent('song', song.id, { ...song.draft, title: song.draft.title.trim(), changeSummary: '批量上传歌曲及同名封面、歌词' })
          locked = false; completed++
          patch(song.id, { phase: 'saved' })
        } catch (error) {
          patch(song.id, { phase: 'error', error: error.message })
          if ([401, 403].includes(error.status)) break
        } finally {
          if (locked) await contentApi.unlock('song', song.id).catch(() => {})
        }
      }
    } finally {
      running.current = false
      if (mounted.current) {
        setSaving(false)
        if (completed) onSaved(completed)
      }
    }
  }
  const acceptedCategories = canUploadCover ? ['audio', 'cover', 'lyrics'] : ['audio', 'lyrics']
  return <AdminDialog title="批量上传歌曲" onClose={onClose} busy={uploading || saving} wide>
    <div className="cms-dialog-body">
      <p className="cms-batch-help">一次最多导入 {MAX_SONGS} 首。音频、封面、歌词可一起选择，文件名去掉扩展名后相同就自动配对，例如：棠梨煎雪.mp3、棠梨煎雪.jpg、棠梨煎雪.lrc。也可先导入音频，再补充同名附件，核对后点击“保存全部歌曲”。</p>
      {!canUploadCover && <p className="cms-batch-help">当前账号可上传音频和歌词；一起上传封面需要“歌曲封面编辑”权限。</p>}
      <BatchUploadDropzone category="audio" label="批量上传歌曲文件" buttonLabel="选择歌曲文件" fileLabel={canUploadCover ? '音频、封面和歌词' : '音频和歌词'} disabled={saving} maxFiles={MAX_SONGS * 3}
        accept={acceptedCategories.flatMap((category) => UPLOAD_TYPES[category].extensions).join(',')}
        hint="音频 MP3 / M4A / WAV / OGG / FLAC / AAC；图片 JPG / PNG / WEBP / GIF / AVIF · 单个最大 25MB；歌词 UTF-8 LRC / TXT · 最大 1MB，需包含时间标签"
        getCategory={songFileCategory} prepareBatch={orderSongFiles}
        validateFile={(entry, entries) => validateSongFile(entry, entries, songsRef.current, canUploadCover, MAX_SONGS)}
        onQueueChange={(entries) => { queueRef.current = entries; setQueue(entries) }} onUploaded={imported} onBusyChange={setUploading} />
      {!!songs.length && <p className="cms-batch-help" role="status">共 {songs.length} 首 · 已保存 {savedCount} 首 · 待保存 {pending.length} 首</p>}
      <div className="cms-batch-songs">{songs.map((song, index) => <section key={song.id} className="cms-batch-song" aria-label={`歌曲 ${index + 1}`}>
        <div className="cms-batch-song-heading"><strong title={song.filename}>{index + 1}. {song.filename}</strong><span className={`cms-badge ${song.phase === 'saved' ? 'green' : 'neutral'}`}>{song.phase === 'saved' ? '已保存' : song.phase === 'saving' ? '保存中…' : song.phase === 'error' ? '保存失败' : '待保存'}</span>
          {song.phase !== 'saved' && <button className="cms-icon danger" type="button" aria-label={`移除歌曲 ${index + 1}`} disabled={saving || uploading} onClick={() => updateSongs((current) => current.filter((item) => item.id !== song.id))}><Trash2 size={16} /></button>}</div>
        <div className="cms-batch-attachments">
          {song.draft.cover && <img src={song.draft.cover} alt={`歌曲 ${index + 1} 封面预览`} />}
          <div>{[['cover', '封面'], ['lyrics', '歌词']].map(([category, label]) => {
            const unfinished = queue.some((entry) => songFileKey(entry.name) === song.fileKey && entry.category === category && entry.phase !== 'success')
            return <p key={category}>{label}：{unfinished ? '有未完成文件，请检查上传列表' : song.sources[category] ? `已匹配 ${song.sources[category]}` : '未选择（可选）'}</p>
          })}</div>
        </div>
        <div className="cms-form-grid">{[['title', '歌曲名称'], ['artist', '演唱者'], ['album', '专辑'], ['releasedAt', '发行时间']].map(([key, label]) => <label key={key}>{label}<input aria-label={`歌曲 ${index + 1} ${label}`} value={song.draft[key]} disabled={saving || song.phase === 'saved'} placeholder={key === 'releasedAt' ? '例如：2026 或 2026-10-13' : ''} onChange={(event) => patch(song.id, { draft: { ...song.draft, [key]: event.target.value } })} /></label>)}</div>
        <audio controls preload="none" src={song.draft.audioUrl} aria-label={`歌曲 ${index + 1} 试听`} />
        {song.sources.lyrics && <details className="cms-batch-lyrics"><summary>查看 / 修改歌词</summary><textarea rows={5} aria-label={`歌曲 ${index + 1} 歌词`} value={song.draft.lyrics || ''} disabled={saving || song.phase === 'saved'} onChange={(event) => patch(song.id, { draft: { ...song.draft, lyrics: event.target.value } })} /></details>}
        {song.error && <p role="alert" className="cms-upload-error">{song.error}</p>}
      </section>)}</div>
    </div>
    <footer className="cms-dialog-footer"><button type="button" className="cms-button" disabled={uploading || saving} onClick={onClose}>关闭</button><button type="button" className="cms-button primary" disabled={uploading || saving || !pending.length} onClick={save}><Save size={16} />{saving ? '保存中…' : uploading ? '等待上传完成…' : `保存全部歌曲（${pending.length}）`}</button></footer>
  </AdminDialog>
}
