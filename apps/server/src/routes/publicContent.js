import { Router } from 'express'
import { publicPhotoAlbum, timelineEntries } from '@artist-wiki/content-types'
import { publicTimelinePage } from '../services/publicTimelineService.js'

const textParam = (value) => typeof value === 'string' ? value.trim() : ''
const visibleItems = (items) => (items || []).filter((item) => !item.deletedAt)

export function createPublicContentRouter({ read }) {
  const router = Router()

  router.get('/content', (request, response) => {
    const content = Object.fromEntries(Object.entries(read()).map(([key, value]) => [key, Array.isArray(value) ? visibleItems(value) : value]))
    content.photos = (content.photos || []).map(publicPhotoAlbum)
    if (request.query.view === 'summary') {
      // 首页只用近讯标题及活动日期、状态统计；正文由时间线接口按页返回。
      content.news = timelineEntries(content.news || [], 'publishedAt').slice(0, 3).map(({ item }) => ({
        id: item.id, title: item.title, publishedAt: item.publishedAt, newsKind: item.newsKind,
      }))
      content.events = (content.events || []).map(({ id, startsAt, status }) => ({ id, startsAt, status }))
    }
    response.json(content)
  })

  router.get('/timeline/:type', (request, response) => {
    const { type } = request.params
    if (!['news', 'events'].includes(type)) return response.status(404).json({ message: '栏目不存在' })
    const offset = Number(request.query.offset ?? 0)
    const limit = Number(request.query.limit ?? 12)
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return response.status(400).json({ message: '分页参数不正确' })
    }
    const query = textParam(request.query.q)
    const tag = textParam(request.query.tag)
    const kind = textParam(request.query.kind)
    const sortOrder = request.query.sort === 'asc' ? 'asc' : 'desc'
    const timeZone = textParam(request.query.timeZone) || 'Asia/Shanghai'
    try { new Intl.DateTimeFormat('zh-CN', { timeZone }) }
    catch { return response.status(400).json({ message: '时区参数不正确' }) }
    response.set('Cache-Control', 'no-store').json(publicTimelinePage(read()[type], type, { q: query, tag, kind, sort: sortOrder, timeZone, offset, limit }))
  })

  return router
}
