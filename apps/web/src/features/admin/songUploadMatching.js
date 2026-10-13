// 配对只依据原始文件名，避免音频标签或用户编辑歌名改变附件归属。
import { UPLOAD_TYPES } from '@artist-wiki/content-types'

export const SONG_UPLOAD_CATEGORIES = ['audio', 'cover', 'lyrics']
export const songFileKey = (name) => name.replace(/\.[^.]+$/, '').normalize('NFKC').trim().toLowerCase()
export function songFileCategory(file) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return SONG_UPLOAD_CATEGORIES.find((category) => UPLOAD_TYPES[category].extensions.includes(extension))
}
// 音频先导入，用户无论以什么顺序选择附件都能配对；重试遵循相同顺序。
export const orderSongFiles = (entries) => [...entries].sort((a, b) => Number(b.category === 'audio') - Number(a.category === 'audio'))

export function validateSongFile(entry, queue, songs, canUploadCover, maxSongs) {
  if (entry.category === 'cover' && !canUploadCover) return '缺少歌曲封面编辑权限，请联系管理员授权'
  const key = songFileKey(entry.name)
  const duplicates = queue.filter((item) => item.phase !== 'success' && item.category === entry.category && songFileKey(item.name) === key)
  if (duplicates.length > 1) return `同名${UPLOAD_TYPES[entry.category].label}有多个，请移除多余文件后重试`
  const song = songs.find((item) => item.fileKey === key)
  if (entry.category === 'audio') {
    if (song) return '已导入同名音频，请移除重复文件'
    if (songs.length >= maxSongs) return `一次最多导入 ${maxSongs} 首歌曲`
  } else {
    if (!song) return '未找到已导入的同名音频，请先上传音频，再重试此文件'
    if (song.phase === 'saved') return '同名歌曲已保存，请关闭窗口后在歌曲列表中编辑'
    if (song.sources[entry.category]) return `已匹配同名${UPLOAD_TYPES[entry.category].label}，请移除重复文件`
  }
  return ''
}
