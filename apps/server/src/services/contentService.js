// 文件作用：apps/server/src/services/contentService.js，负责后端服务的独立功能模块。
import { cloneState, getState, nextId, persist } from '../store.js'
import { normalizePhotoAlbum } from '@artist-wiki/content-types'

const collectionFor = { profile: 'profile', news: 'news', event: 'events', photo: 'photos', song: 'songs', video: 'videos' }

export function listContent() {
  const state = getState()
  return cloneState(state.content)
}

export function getItem(type, id) {
  const collection = collectionFor[type]
  const source = getState().content[collection]
  return type === 'profile' ? source : source.find((item) => item.id === id)
}

function setItem(type, item) {
  const collection = collectionFor[type]
  if (type === 'profile') getState().content.profile = item
  else {
    const index = getState().content[collection].findIndex((value) => value.id === item.id)
    if (index >= 0) getState().content[collection][index] = item
    else getState().content[collection].push(item)
  }
}

export async function saveItem(type, id, payload, actor, summary = '更新内容') {
  const previous = getItem(type, id)
  const now = new Date().toISOString()
  const merged = { ...(previous || {}), ...payload, id, type, createdAt: previous?.createdAt || now, updatedAt: now }
  const item = type === 'photo' ? normalizePhotoAlbum(merged) : merged
  const versions = getState().versions.filter((version) => version.type === type && version.contentId === id)
  // 首次编辑旧数据时先保留原始快照，否则删除或第一次保存后无法还原初始内容。
  if (!versions.length && previous) {
    const initial = { id: nextId('version'), type, contentId: id, versionNo: '1.0', snapshot: cloneState(previous), changeSummary: '初始版本', createdAt: new Date().toISOString(), createdBy: actor.username }
    getState().versions.push(initial)
    versions.push(initial)
  }
  const version = {
    id: nextId('version'),
    type,
    contentId: id,
    versionNo: `${Math.floor(versions.length / 10) + 1}.${versions.length % 10}`,
    snapshot: cloneState(item),
    changeSummary: summary,
    createdAt: new Date().toISOString(),
    createdBy: actor.username,
  }
  getState().versions.push(version)
  setItem(type, item)
  await persist()
  return item
}

export async function deleteItem(type, id, actor) {
  const item = getItem(type, id)
  if (!item) return null
  await saveItem(type, id, { ...item, deletedAt: new Date().toISOString() }, actor, '删除内容')
  return item
}

export function listVersions(type, id) {
  return getState().versions.filter((version) => version.type === type && version.contentId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ snapshot, ...version }) => version)
}

export async function restoreItem(type, id, versionId, actor) {
  const version = getState().versions.find((item) => item.id === versionId && item.type === type && item.contentId === id)
  if (!version) throw new Error('历史版本不存在')
  const snapshot = type === 'photo' ? normalizePhotoAlbum(version.snapshot) : version.snapshot
  return saveItem(type, id, { ...snapshot, deletedAt: snapshot.deletedAt || null }, actor, `恢复版本 ${version.versionNo}`)
}

export function getSnapshot(type, id, versionId) {
  return getState().versions.find((item) => item.id === versionId && item.type === type && item.contentId === id)?.snapshot || null
}
