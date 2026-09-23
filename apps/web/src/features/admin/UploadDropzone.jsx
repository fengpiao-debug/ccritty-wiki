// 文件作用：复用单文件拖拽/选择上传控件，负责格式预检、进度、取消和错误显示，成功后把结果交回表单。
import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, FileUp, UploadCloud, X } from 'lucide-react'
import { UPLOAD_TYPES, validateUploadMetadata } from '@artist-wiki/content-types'
import { uploadFile } from './uploadApi'

export function UploadDropzone({ category, label, disabled = false, onUploaded, onBusyChange, onTextDrop }) {
  const rule = UPLOAD_TYPES[category]
  const inputId = useId()
  const inputRef = useRef(null)
  const controller = useRef(null)
  const running = useRef(false)
  const resolvingText = useRef(false)
  const depth = useRef(0)
  const mounted = useRef(true)
  const callbacks = useRef({ onUploaded, onBusyChange })
  callbacks.current = { onUploaded, onBusyChange }
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState({ phase: 'idle', name: '', progress: 0, error: '' })
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])
  async function select(files) {
    if (disabled || running.current || resolvingText.current) return
    if (files.length !== 1) { setState({ phase: 'error', error: '每次只能上传一个文件', progress: 0, name: '' }); return }
    const file = files[0]
    const error = validateUploadMetadata(file, category)
    if (error) { setState({ phase: 'error', error, name: file.name, progress: 0 }); return }
    running.current = true
    controller.current = new AbortController()
    callbacks.current.onBusyChange?.(true)
    setState({ phase: 'uploading', error: '', name: file.name, progress: 0 })
    try {
      const result = await uploadFile(file, category, { signal: controller.current.signal, onProgress: (progress) => {
        if (mounted.current) setState((current) => ({ ...current, progress }))
      } })
      if (!mounted.current) return
      if (category === 'video') setState({ phase: 'resolving', error: '', name: result?.bvid || file.name, progress: 0 })
      await callbacks.current.onUploaded?.(result)
      if (!mounted.current) return
      setState({ phase: 'success', name: file.name, progress: 100, error: '' })
    } catch (err) {
      if (mounted.current) setState({ phase: 'error', name: file.name, progress: 0, error: err.name === 'AbortError' ? '已取消上传' : err.message })
    } finally {
      running.current = false
      callbacks.current.onBusyChange?.(false)
    }
  }
  async function drop(event) {
    event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false)
    if (disabled || running.current) return
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) { select(files); return }
    if (onTextDrop) {
      const source = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
      resolvingText.current = true
      try {
        setState({ phase: 'resolving', name: '', progress: 0, error: '' })
        const result = await onTextDrop(source)
        if (!mounted.current) return
        setState({ phase: 'success', name: result?.bvid || 'B 站视频信息', progress: 100, error: '' })
      }
      catch (err) { if (mounted.current) setState({ phase: 'error', name: '', progress: 0, error: err.message }) }
      finally { resolvingText.current = false }
    } else setState({ phase: 'error', name: '', progress: 0, error: '请拖入一个文件' })
  }
  const uploading = state.phase === 'uploading'
  const busy = uploading || state.phase === 'resolving'
  return <div className={`cms-upload${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
    role="group" aria-label={label}
    onDragEnter={(event) => { event.preventDefault(); depth.current++; if (!disabled && !running.current) setDragging(true) }}
    onDragLeave={(event) => { event.preventDefault(); depth.current--; if (depth.current <= 0) setDragging(false) }}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = disabled || busy ? 'none' : 'copy' }}
    onDrop={drop}>
    <input ref={inputRef} id={inputId} aria-label={label} type="file" hidden accept={rule.extensions.join(',')} disabled={disabled || busy}
      onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) select(files) }} />
    <div className="cms-upload-main">
      {state.phase === 'success' ? <CheckCircle2 size={24} className="cms-upload-success" /> : <UploadCloud size={24} />}
      <div><strong>{label}</strong><small>{rule.hint}</small>{state.name && <span className="cms-upload-filename" title={state.name}>{state.name}</span>}</div>
      <button className="cms-button" type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()}><FileUp size={16} />{state.phase === 'error' ? '重新选择' : '选择文件'}</button>
    </div>
    {uploading && <div className="cms-upload-progress"><progress value={state.progress} max="100" aria-label={`${label}进度`} /><span role="status">{state.progress === 100 ? '服务器校验中…' : `${state.progress}%`}</span><button type="button" className="cms-icon" aria-label={`取消${label}`} title="取消上传" onClick={() => controller.current?.abort()}><X size={16} /></button></div>}
    {state.phase === 'resolving' && <p className="cms-upload-success" role="status">正在请求 B 站视频信息…</p>}
    {state.error && <p className="cms-upload-error" role="alert">{state.error}</p>}
    {state.phase === 'success' && <p className="cms-upload-success" role="status">已导入表单，尚未保存内容</p>}
  </div>
}
