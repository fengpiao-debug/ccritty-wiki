// 文件作用：apps/web/src/features/public/useContent.jsx，负责公开 Wiki 内容展示。
import { useEffect, useSyncExternalStore } from 'react'
import { contentApi } from '../../lib/api'
import { normalizeContent } from '../../utils/content'

// 所有页面和播放器共享同一次请求及结果，首次加载和失败时均不显示演示资料。
let snapshot = { content: normalizeContent(null), loading: true, error: '', hasContent: false }
let loadingPromise = null
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
const getSnapshot = () => snapshot
function update(next) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((listener) => listener())
}

function reload() {
  if (!loadingPromise) {
    update({ loading: !snapshot.hasContent, error: '' })
    loadingPromise = Promise.resolve().then(() => contentApi.getPublic()).then((payload) => {
      update({ content: normalizeContent(payload), loading: false, error: '', hasContent: true })
    }).catch((error) => {
      update({ loading: false, error: error.message || '内容暂时无法加载' })
    }).finally(() => { loadingPromise = null })
  }
  return loadingPromise
}

export function useContent() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    reload()
  }, [])
  return { ...state, reload }
}
