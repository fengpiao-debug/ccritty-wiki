// 文件作用：完成图片解码重编码、资源随机命名，以及正文/歌词/B站信息导入；文本不落地公开目录。
import sharp from 'sharp'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseBuffer } from 'music-metadata'
import { parseBilibili } from '@artist-wiki/content-types'
import { validateUpload } from './uploadValidation.js'

const windows1252Bytes = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

export function decodeMultipartFilename(name) {
  const value = String(name || '')
  if (!/[ÃÂÐÑà-ÿ]/u.test(value)) return value
  try {
    const bytes = Uint8Array.from([...value].map((character) => windows1252Bytes[character] ?? character.charCodeAt(0)))
    const decoded = Buffer.from(bytes).toString('utf8')
    if (!decoded.includes('\ufffd') && /[\u4e00-\u9fff]/u.test(decoded)) return decoded
  } catch {}
  return value
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim() : ''
}

function filenameMetadata(name) {
  const base = path.basename(name, path.extname(name)).trim()
  const parts = base.split(/\s+(?:-|–|—)\s+/u).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join(' - ') }
  return { title: base }
}

function parseLyricMetadata(text, name = '') {
  const read = (key) => cleanText(text.match(new RegExp(`^\\[${key}:([^\\]]+)\\]`, 'im'))?.[1])
  const fallback = filenameMetadata(name.replace(/\.(?:lrc|txt)$/i, '.mp3'))
  return {
    title: read('ti') || fallback.title,
    artist: read('ar') || fallback.artist || '',
    album: read('al'),
    releasedAt: read('re') || read('date'),
  }
}

async function parseAudioMetadata(file, extension) {
  const fallback = filenameMetadata(file.originalname)
  try {
    const parsed = await parseBuffer(file.buffer, { mimeType: file.mimetype, path: file.originalname })
    const common = parsed.common || {}
    const metadata = {
      title: cleanText(common.title) || fallback.title,
      artist: cleanText(common.artist) || cleanText(common.artists?.join(' / ')) || fallback.artist || '',
      extension,
    }
    const album = cleanText(common.album)
    const releasedAt = cleanText(common.year ? String(common.year) : '')
    const genre = cleanText(common.genre?.join(' / '))
    if (album) metadata.album = album
    if (releasedAt) metadata.releasedAt = releasedAt
    if (genre) metadata.genre = genre
    if (Number.isFinite(parsed.format?.duration)) metadata.duration = Math.round(parsed.format.duration)
    return metadata
  } catch {
    return { ...fallback, extension }
  }
}

export async function prepareUpload(file, category) {
  const normalizedFile = { ...file, originalname: decodeMultipartFilename(file.originalname) }
  const validation = validateUpload(normalizedFile, category)
  if (!validation.ok) return validation
  if (category === 'video') {
    try { return { ok: true, result: { ...parseBilibili(validation.text), name: normalizedFile.originalname } } }
    catch (error) { return { ok: false, message: error.message } }
  }
  if (category === 'lyrics') {
    return {
      ok: true,
      result: {
        text: validation.text,
        name: normalizedFile.originalname,
        metadata: parseLyricMetadata(validation.text, normalizedFile.originalname),
      },
    }
  }
  if (category === 'text') return { ok: true, result: { text: validation.text, name: normalizedFile.originalname } }
  let buffer = file.buffer
  let extension = validation.extension
  if (category === 'siteQrCode') {
    try {
      // 二维码保留原始分辨率，不缩放裁剪，避免影响识别。
      buffer = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate().png().toBuffer()
      extension = '.png'
    } catch { return { ok: false, message: '图片无法安全解码，可能已损坏、尺寸过大或内容伪装' } }
  } else if (category === 'siteIcon' || category === 'siteLogo') {
    try {
      // 站点图片取第一帧并转成 PNG，favicon 使用透明留边，保留原始比例。
      buffer = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' })
        .rotate().resize(category === 'siteIcon' ? 64 : 256, category === 'siteIcon' ? 64 : 256,
          { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      extension = '.png'
    } catch { return { ok: false, message: '图片无法安全解码，可能已损坏、尺寸过大或内容伪装' } }
  } else if (category === 'image' || category === 'cover') {
    try {
      // 重编码去除原始尾部及元数据，禁止仅带合法文件头的损坏图片进入公开目录。
      buffer = await sharp(buffer, { animated: true, limitInputPixels: 40_000_000, failOn: 'warning' })
        .toFormat(({ '.jpg': 'jpeg', '.jpeg': 'jpeg', '.avif': 'avif' })[validation.extension] || validation.extension.slice(1)).toBuffer()
    } catch { return { ok: false, message: '图片无法安全解码，可能已损坏、尺寸过大或内容伪装' } }
  }
  if (buffer.length > 25 * 1024 * 1024) return { ok: false, message: '处理后的资源超过 25MB 限制' }
  const metadata = category === 'audio' ? await parseAudioMetadata(normalizedFile, validation.extension) : null
  return { ok: true, buffer, extension, metadata }
}

export async function saveUpload(prepared, category, root = path.resolve(process.cwd(), 'uploads')) {
  const folder = category === 'audio' ? 'audio' : 'images'
  const directory = path.join(root, folder)
  await fs.mkdir(directory, { recursive: true })
  const fileName = `${crypto.randomUUID()}${prepared.extension}`
  await fs.writeFile(path.join(directory, fileName), prepared.buffer, { flag: 'wx' })
  return { url: `/uploads/${folder}/${fileName}` }
}
