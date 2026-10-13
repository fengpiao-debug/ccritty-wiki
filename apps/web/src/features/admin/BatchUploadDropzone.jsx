// 图片和音频共用的上传队列：逐文件校验、进度、取消和重试，成功项只回填一次。
import { useEffect, useRef, useState } from 'react'
import { FileUp, UploadCloud } from 'lucide-react'
import { createId, UPLOAD_TYPES, validateUploadMetadata } from '@artist-wiki/content-types'
import { uploadFile } from './uploadApi'

export function BatchUploadDropzone({ category, label, inputLabel = label, buttonLabel = '选择文件', fileLabel, accept, hint, maxFiles = 100, limitMessage, disabled = false, onUploaded, onBusyChange, getCategory, prepareBatch, validateFile, onQueueChange }) {
  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const queue = useRef([])
  const input = useRef(null)
  const controller = useRef(null)
  const mounted = useRef(true)
  const callbacks = useRef({ onUploaded, onBusyChange, prepareBatch, validateFile, onQueueChange })
  callbacks.current = { onUploaded, onBusyChange, prepareBatch, validateFile, onQueueChange }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])

  function publish(next) {
    queue.current = next
    if (mounted.current) {
      setEntries(next)
      callbacks.current.onQueueChange?.(next.map(({ id, name, category, phase, error }) => ({ id, name, category, phase, error })))
    }
  }
  function update(id, changes) {
    publish(queue.current.map((entry) => entry.id === id ? { ...entry, ...changes } : entry))
  }
  async function run(selected) {
    if (disabled || controller.current || !selected.length) return
    if (selected.length > maxFiles) { setMessage(limitMessage || `本次最多还能添加 ${maxFiles} 个文件`); return }
    selected = callbacks.current.prepareBatch?.(selected) || selected
    const abortController = new AbortController()
    controller.current = abortController
    setBusy(true); setMessage(''); setCancelled(false)
    const ids = new Set(selected.map((entry) => entry.id))
    publish(queue.current.map((entry) => ids.has(entry.id) ? { ...entry, phase: 'queued', error: '', progress: 0 } : entry))
    callbacks.current.onBusyChange?.(true)
    try {
      for (const entry of selected) {
        if (abortController.signal.aborted || !mounted.current) break
        try {
          const uploadCategory = entry.category || category
          const invalid = validateUploadMetadata(entry.file, uploadCategory) || callbacks.current.validateFile?.(entry, queue.current)
          if (invalid) throw new Error(invalid)
          update(entry.id, { phase: 'uploading' })
          const result = entry.result || await uploadFile(entry.file, uploadCategory, {
            signal: abortController.signal,
            onProgress: (progress) => { if (mounted.current) update(entry.id, { progress }) },
          })
          if (!mounted.current) break
          // 上传完成但回填失败时，重试复用已上传的资源。
          update(entry.id, { result })
          if (abortController.signal.aborted) break
          await callbacks.current.onUploaded(result, entry.file)
          update(entry.id, { phase: 'success', progress: 100, file: null, result: null })
        } catch (error) {
          if (!mounted.current || error.name === 'AbortError') break
          update(entry.id, { phase: 'error', error: error.message })
          if ([401, 403].includes(error.status)) { setMessage('登录或权限已失效，已停止后续上传'); break }
        }
      }
    } finally {
      controller.current = null
      if (mounted.current) {
        publish(queue.current.map((entry) => ['queued', 'uploading'].includes(entry.phase) ? { ...entry, phase: 'cancelled' } : entry))
        setCancelled(abortController.signal.aborted)
        setBusy(false)
        callbacks.current.onBusyChange?.(false)
      }
    }
  }
  function select(files) {
    if (disabled || controller.current || !files.length) return
    if (files.length > maxFiles) { setMessage(limitMessage || `本次最多还能添加 ${maxFiles} 个文件`); return }
    const added = Array.from(files, (file) => ({ id: createId('upload'), file, name: file.name, category: getCategory?.(file) || category, phase: 'queued', progress: 0, error: '' }))
    publish([...queue.current, ...added])
    run(added)
  }
  const successful = entries.filter((entry) => entry.phase === 'success').length
  const failed = entries.filter((entry) => entry.phase === 'error')
  const remaining = entries.filter((entry) => ['error', 'cancelled'].includes(entry.phase))
  const current = entries.find((entry) => entry.phase === 'uploading')
  const status = { queued: '等待上传', success: '已导入', error: '上传失败', cancelled: '未完成' }
  return <div className={`cms-upload${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`} role="group" aria-label={label}
    onDragOver={(event) => { event.preventDefault(); if (!disabled && !busy) setDragging(true) }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); select(event.dataTransfer.files) }}>
    <input ref={input} type="file" hidden multiple aria-label={inputLabel} accept={accept || UPLOAD_TYPES[category].extensions.join(',')} disabled={disabled || busy || maxFiles <= 0}
      onChange={(event) => { select(Array.from(event.target.files || [])); event.target.value = '' }} />
    <div className="cms-upload-main"><UploadCloud size={24} /><div><strong>拖入多个{fileLabel || UPLOAD_TYPES[category].label}文件，或批量选择</strong><small>{hint || `${UPLOAD_TYPES[category].hint} / 个 · 还可添加 ${maxFiles} 个`}</small></div>
      <button className="cms-button" type="button" disabled={disabled || busy || maxFiles <= 0} onClick={() => input.current?.click()}><FileUp size={16} />{buttonLabel}</button></div>
    {!!entries.length && <>
      <p role="status" className="cms-album-progress">{busy ? `正在处理 ${current ? entries.indexOf(current) + 1 : successful + failed.length + 1} / ${entries.length}${current ? ` · ${current.name}` : ''}` : `${cancelled ? '已取消后续上传；' : ''}已导入 ${successful} 个文件${remaining.length ? `，${remaining.length} 个未完成` : ''}。`}</p>
      <ul className="cms-batch-queue" aria-label="文件上传状态">{entries.map((entry) => <li key={entry.id}>
        <span className="cms-batch-filename" title={entry.name}>{entry.name}</span><span className={entry.phase === 'success' ? 'cms-upload-success' : ''}>{entry.phase === 'uploading' ? (entry.progress === 100 ? '服务器校验中…' : `${entry.progress}%`) : status[entry.phase]}</span>
        {entry.phase === 'uploading' && <progress value={entry.progress} max={100} aria-label={`${entry.name}上传进度`} />}
        {!busy && ['error', 'cancelled'].includes(entry.phase) && <button type="button" className="cms-link-button" disabled={disabled} onClick={() => publish(queue.current.filter((item) => item.id !== entry.id))} aria-label={`移除未完成文件 ${entry.name}`}>移除</button>}
      </li>)}</ul>
    </>}
    {(message || failed.length > 0) && <div role="alert" className="cms-upload-error">{message && <p>{message}</p>}{failed.map((entry) => <p key={entry.id}>{entry.name}：{entry.error}</p>)}</div>}
    <div className="cms-batch-actions">
      {busy && <button type="button" className="cms-button" onClick={() => controller.current?.abort()}>取消后续上传</button>}
      {!busy && remaining.length > 0 && <button type="button" className="cms-button" disabled={disabled || maxFiles <= 0} onClick={() => run(remaining)}>重试未完成文件（{remaining.length}）</button>}
    </div>
  </div>
}
