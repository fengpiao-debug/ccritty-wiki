// 文件作用：校验上传元数据、扩展名对应 MIME 和魔数；文本只接受有效 UTF-8，不作为静态文件保存。
import path from 'node:path'
import { validateUploadMetadata } from '@artist-wiki/content-types'

const mimes = {
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'],
  '.webp': ['image/webp'], '.gif': ['image/gif'], '.avif': ['image/avif'],
  '.mp3': ['audio/mpeg', 'audio/mp3'], '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  '.ogg': ['audio/ogg', 'application/ogg'], '.flac': ['audio/flac', 'audio/x-flac'],
  '.aac': ['audio/aac', 'audio/x-aac'],
  '.md': ['text/markdown', 'text/plain', 'text/x-markdown', 'application/octet-stream'],
  '.txt': ['text/plain', 'application/octet-stream'],
  '.lrc': ['text/plain', 'application/octet-stream', 'application/x-subrip'],
}
const ascii = (buffer, start, end) => buffer.subarray(start, end).toString('ascii')
const prefix = (buffer, bytes) => bytes.every((value, index) => buffer[index] === value)

function matchesMagic(buffer, extension) {
  if (extension === '.jpg' || extension === '.jpeg') return prefix(buffer, [0xff, 0xd8, 0xff])
  if (extension === '.png') return prefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (extension === '.webp') return ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP'
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(ascii(buffer, 0, 6))
  if (extension === '.avif' || extension === '.m4a') {
    if (buffer.length < 16 || ascii(buffer, 4, 8) !== 'ftyp') return false
    const boxSize = buffer.readUInt32BE(0)
    if (boxSize < 16 || boxSize > buffer.length || boxSize > 4096) return false
    const brands = [ascii(buffer, 8, 12)]
    for (let index = 16; index + 4 <= boxSize; index += 4) brands.push(ascii(buffer, index, index + 4))
    return extension === '.avif' ? brands.some((brand) => ['avif', 'avis'].includes(brand)) :
      !brands.some((brand) => ['avif', 'avis'].includes(brand)) && brands.some((brand) => ['M4A ', 'isom', 'iso2', 'mp41', 'mp42'].includes(brand))
  }
  if (extension === '.wav') return buffer.length >= 44 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WAVE'
  if (extension === '.ogg') return buffer.length >= 27 && ascii(buffer, 0, 4) === 'OggS'
  if (extension === '.flac') return buffer.length >= 42 && ascii(buffer, 0, 4) === 'fLaC'
  if (extension === '.mp3') return (buffer.length >= 10 && ascii(buffer, 0, 3) === 'ID3') ||
    (buffer.length >= 4 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 6) !== 0)
  if (extension === '.aac') return buffer.length >= 7 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0
  return false
}

export function validateUpload(file, inputCategory) {
  const category = inputCategory === 'music' ? 'audio' : inputCategory
  const buffer = file?.buffer
  if (!Buffer.isBuffer(buffer)) return { ok: false, message: '缺少文件内容' }
  const error = validateUploadMetadata({ name: file.originalname, size: buffer.length }, category)
  if (error) return { ok: false, message: error }
  const extension = path.extname(file.originalname).toLowerCase()
  const mime = String(file.mimetype || '').toLowerCase()
  const isText = ['text', 'lyrics', 'video'].includes(category)
  // 一些浏览器不提供 LRC/Markdown 的 MIME；仅在服务器成功 UTF-8 解码后才允许。
  if (!(isText && !mime) && !mimes[extension]?.includes(mime)) return { ok: false, message: '文件 MIME 类型与扩展名不匹配' }
  if (isText) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text) || /^(MZ|#!|<\?php)/i.test(text.trim())) throw new Error()
      if (category === 'lyrics' && !/\[\d{2}:\d{2}(?:[.:]\d{1,3})?\]/.test(text)) return { ok: false, message: '歌词文件缺少 LRC 时间标签' }
      return { ok: true, extension, text }
    } catch { return { ok: false, message: '文件不是有效的 UTF-8 文本，或包含二进制/脚本内容' } }
  }
  if (!matchesMagic(buffer, extension)) return { ok: false, message: '文件内容校验失败，疑似伪装文件' }
  return { ok: true, extension }
}
