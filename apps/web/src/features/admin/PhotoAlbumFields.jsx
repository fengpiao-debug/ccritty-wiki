import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-react'
import { createId, PHOTO_CATEGORIES, PHOTO_AUTHOR_TYPES, MAX_ALBUM_IMAGES, normalizePhotoAlbum, UPLOAD_TYPES } from '@artist-wiki/content-types'
import { BatchUploadDropzone } from './BatchUploadDropzone'
import { toDateTimeInput } from '../../lib/dateTime'

export function PhotoAlbumFields({ value, onChange, disabled, uploads, onBusyChange }) {
  const album = normalizePhotoAlbum(value)
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const callbacks = useRef({ onChange, onBusyChange })
  callbacks.current = { onChange, onBusyChange }
  const patch = (changes) => callbacks.current.onChange?.((current) => {
    const before = normalizePhotoAlbum(current)
    return normalizePhotoAlbum({ ...before, ...(typeof changes === 'function' ? changes(before) : changes) })
  })
  function appendImage(url) {
    patch((current) => ({ images: [...current.images, { id: createId('image'), url, keywords: '', description: '' }] }))
  }
  function updateImage(id, changes) {
    patch((current) => ({ images: current.images.map((item) => item.id === id ? { ...item, ...changes } : item) }))
  }
  function moveImage(index, offset) {
    patch((current) => {
      const images = [...current.images]
      ;[images[index], images[index + offset]] = [images[index + offset], images[index]]
      return { images }
    })
  }
  const localTime = toDateTimeInput(album.publishedAt)
  return <div className="cms-album-editor">
    <div className="cms-form-grid">
      <label>图集标题<input required maxLength={200} disabled={disabled} value={album.title} placeholder="例如：秋日音乐节 · 现场记录" onChange={(e) => patch({ title: e.target.value })} /></label>
      <label>大分类<select disabled={disabled} value={album.category} onChange={(e) => patch({ category: e.target.value })}>{PHOTO_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="full">图集说明<textarea rows={4} maxLength={10000} disabled={disabled} value={album.description} placeholder="记录这一组照片的故事、发布背景等" onChange={(e) => patch({ description: e.target.value })} /></label>
      <label>作者类型<select disabled={disabled} value={album.authorType} onChange={(e) => patch({ authorType: e.target.value })}>{PHOTO_AUTHOR_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>作者 / 摄影署名<input maxLength={200} disabled={disabled} value={album.authorName} placeholder="填写摄影师、官方账号或投稿者名称" onChange={(e) => patch({ authorName: e.target.value })} /></label>
      {album.authorType === 'fan' && <>
        <label>粉丝 ID（选填）<input maxLength={100} disabled={disabled} value={album.fanId} onChange={(e) => patch({ fanId: e.target.value })} /></label>
        <label className="cms-album-checkbox"><input type="checkbox" disabled={disabled} checked={album.showFanId} onChange={(e) => patch({ showFanId: e.target.checked })} />前台展示粉丝 ID</label>
      </>}
      <label>拍摄 / 发布时间<input type="datetime-local" disabled={disabled} value={localTime} onChange={(e) => patch({ publishedAt: e.target.value })} /></label>
      <label>地点<input maxLength={300} disabled={disabled} value={album.location} placeholder="例如：杭州 · 音乐节主舞台" onChange={(e) => patch({ location: e.target.value })} /></label>
    </div>
    <div className="cms-album-section"><h3>图集照片 <span>{album.images.length} 张</span></h3><p>选择一张作为封面，逐张填写关键词和描述。可调整照片顺序。</p></div>
    {uploads && !disabled && <BatchUploadDropzone category="image" label="批量上传图集图片" inputLabel="选择图集图片" buttonLabel="选择图片"
      hint={`${UPLOAD_TYPES.image.hint} / 张 · 每个图集最多 ${MAX_ALBUM_IMAGES} 张`}
      maxFiles={MAX_ALBUM_IMAGES - album.images.length} limitMessage={`每个图集最多 ${MAX_ALBUM_IMAGES} 张图片`}
      onUploaded={(result) => appendImage(result.url)} onBusyChange={(active) => { setBusy(active); callbacks.current.onBusyChange?.(active) }} />}
    {!disabled && <div className="cms-album-url"><label>添加图片地址<input type="url" value={imageUrl} disabled={busy} placeholder="https://… 或 /uploads/images/…" onChange={(e) => setImageUrl(e.target.value)} /></label><button className="cms-button" type="button" disabled={busy || !imageUrl.trim() || album.images.length >= MAX_ALBUM_IMAGES} onClick={() => { appendImage(imageUrl.trim()); setImageUrl('') }}>添加图片</button></div>}
    <div className="cms-album-images">{album.images.map((image, index) => <section key={image.id} className="cms-album-image" aria-label={'图片 ' + (index + 1)}>
      <div className="cms-album-thumb">{image.url && <img src={image.url} alt={'图集图片 ' + (index + 1)} loading="lazy" />}<span>{index + 1}{album.coverImageId === image.id ? ' · 封面' : ''}</span></div>
      <div className="cms-album-image-fields">
        <label>图片 {index + 1} 关键词<input maxLength={2000} disabled={disabled} value={image.keywords} placeholder="例如：舞台、红裙、返场、侧颜" onChange={(e) => updateImage(image.id, { keywords: e.target.value })} /></label>
        <label>图片 {index + 1} 描述<textarea maxLength={2000} rows={2} disabled={disabled} value={image.description} placeholder="补充这张照片的内容" onChange={(e) => updateImage(image.id, { description: e.target.value })} /></label>
        <label>图片 {index + 1} 地址<input disabled={disabled} value={image.url} onChange={(e) => updateImage(image.id, { url: e.target.value })} /></label>
        {!disabled && <div className="cms-album-actions">
          <button type="button" className="cms-button" aria-pressed={album.coverImageId === image.id} onClick={() => patch({ coverImageId: image.id })}>{album.coverImageId === image.id && <Check size={14} />}{album.coverImageId === image.id ? '已设为封面' : '设为封面'}</button>
          <button type="button" className="cms-icon" aria-label={'上移图片 ' + (index + 1)} disabled={!index || busy} onClick={() => moveImage(index, -1)}><ArrowUp size={16} /></button>
          <button type="button" className="cms-icon" aria-label={'下移图片 ' + (index + 1)} disabled={index === album.images.length - 1 || busy} onClick={() => moveImage(index, 1)}><ArrowDown size={16} /></button>
          <button type="button" className="cms-icon danger" aria-label={'移除图片 ' + (index + 1)} disabled={busy} onClick={() => patch((current) => ({ images: current.images.filter((item) => item.id !== image.id) }))}><Trash2 size={16} /></button>
        </div>}
      </div>
    </section>)}</div>
    {!album.images.length && <p className="cms-album-empty">还没有照片，上传图片或添加图片地址开始建立图集。</p>}
  </div>
}
