// 文件作用：使用带鉴权的 multipart 请求上传单个文件，支持真实传输进度、超时和取消。
import { API_BASE } from '../../lib/api'

export function uploadFile(file, category, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const finish = (callback, value) => {
      signal?.removeEventListener('abort', abort)
      callback(value)
    }
    xhr.open('POST', `${API_BASE}/admin/upload?category=${encodeURIComponent(category)}`)
    xhr.timeout = 120000
    const token = localStorage.getItem('artist-wiki-token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100)))
    }
    xhr.onload = () => {
      let payload
      try { payload = JSON.parse(xhr.responseText) } catch { finish(reject, new Error('上传服务响应格式不正确')); return }
      if (xhr.status >= 200 && xhr.status < 300) finish(resolve, payload)
      else {
        if (xhr.status === 401) window.dispatchEvent(new Event('wiki:session-expired'))
        const error = new Error(payload.message || `上传失败（${xhr.status}）`)
        error.status = xhr.status
        finish(reject, error)
      }
    }
    xhr.onerror = () => finish(reject, new Error('网络异常，文件未上传成功'))
    xhr.ontimeout = () => finish(reject, new Error('上传超时，请重试'))
    xhr.onabort = () => finish(reject, new DOMException('已取消上传', 'AbortError'))
    if (signal?.aborted) { reject(new DOMException('已取消上传', 'AbortError')); return }
    signal?.addEventListener('abort', abort, { once: true })
    const body = new FormData()
    body.append('file', file)
    xhr.send(body)
  })
}
