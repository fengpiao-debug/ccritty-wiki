// 文件作用：完成图片解码重编码、资源随机命名，以及正文/歌词/B站信息导入；文本不落地公开目录。
import sharp from 'sharp'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseBilibili } from '@artist-wiki/content-types'
import { validateUpload } from './uploadValidation.js'

export async function prepareUpload(file, category) {
  const validation = validateUpload(file, category)
  if (!validation.ok) return validation
  if (category === 'video') {
    try { return { ok: true, result: { ...parseBilibili(validation.text), name: file.originalname } } }
    catch (error) { return { ok: false, message: error.message } }
  }
  if (['text', 'lyrics'].includes(category)) return { ok: true, result: { text: validation.text, name: file.originalname } }
  let buffer = file.buffer
  if (category === 'image') {
    try {
      // 重编码去除原始尾部及元数据，禁止仅带合法文件头的损坏图片进入公开目录。
      buffer = await sharp(buffer, { animated: true, limitInputPixels: 40_000_000, failOn: 'warning' })
        .toFormat(({ '.jpg': 'jpeg', '.jpeg': 'jpeg', '.avif': 'avif' })[validation.extension] || validation.extension.slice(1)).toBuffer()
    } catch { return { ok: false, message: '图片无法安全解码，可能已损坏、尺寸过大或内容伪装' } }
  }
  if (buffer.length > 25 * 1024 * 1024) return { ok: false, message: '处理后的资源超过 25MB 限制' }
  return { ok: true, buffer, extension: validation.extension }
}

export async function saveUpload(prepared, category, root = path.resolve(process.cwd(), 'uploads')) {
  const folder = category === 'audio' ? 'audio' : 'images'
  const directory = path.join(root, folder)
  await fs.mkdir(directory, { recursive: true })
  const fileName = `${crypto.randomUUID()}${prepared.extension}`
  await fs.writeFile(path.join(directory, fileName), prepared.buffer, { flag: 'wx' })
  return { url: `/uploads/${folder}/${fileName}` }
}
