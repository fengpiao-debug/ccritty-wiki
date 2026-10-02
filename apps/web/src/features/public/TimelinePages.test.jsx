// 验证动态排序和活动图片展示，使用模拟内容，避免修改真实资料。
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { NewsPage } from './NewsPage'
import { EventsPage } from './EventsPage'

const fixture = vi.hoisted(() => ({ content: { news: [], events: [] }, loading: false }))
vi.mock('./useContent', () => ({ useContent: () => fixture }))
beforeEach(() => { fixture.content = { news: [], events: [] }; fixture.loading = false })
afterEach(cleanup)

it('动态按新到旧排列，无日期项放最后，并保留来源和原始数据顺序', () => {
  fixture.content.news = [
    { id: 'old', title: '较早动态', publishedAt: '2025-01-01', markdown: '旧消息' },
    { id: 'unknown', title: '待定动态', publishedAt: 'invalid', markdown: '' },
    { id: 'new', title: '最新动态', publishedAt: '2026-10-02', markdown: '新消息', sourceName: '官方发布', sourceUrl: 'https://example.com/news' },
  ]
  render(<NewsPage />)
  const timeline = screen.getByRole('list', { name: '动态时间线' })
  expect(within(timeline).getAllByRole('heading').map((node) => node.textContent)).toEqual(['最新动态', '较早动态', '待定动态'])
  expect(fixture.content.news.map((item) => item.id)).toEqual(['old', 'unknown', 'new'])
  expect(screen.getByText('日期待定')).toBeTruthy()
  expect(screen.getByRole('link', { name: '查看来源' }).getAttribute('href')).toBe('https://example.com/news')
})

it('空动态列表区分加载中和暂无内容', () => {
  fixture.loading = true
  const view = render(<NewsPage />)
  expect(screen.getByRole('status').textContent).toBe('正在加载动态…')
  expect(screen.queryByText('暂无动态，新的消息将在这里记录。')).toBeNull()
  fixture.loading = false
  view.rerender(<NewsPage />)
  expect(screen.getByText('暂无动态，新的消息将在这里记录。')).toBeTruthy()
})

it('活动封面读取已保存地址，无封面项不产生空图片且保留票务链接', () => {
  fixture.content.events = [
    { id: 'poster', title: '杭州演出', startsAt: '2026-10-02', status: 'upcoming', cover: '/uploads/images/poster.png', ticketUrl: 'https://example.com/tickets' },
    { id: 'plain', title: '无图活动', startsAt: '2026-10-03', status: 'upcoming', cover: '' },
  ]
  render(<EventsPage />)
  expect(screen.getAllByRole('img')).toHaveLength(1)
  expect(screen.getByRole('img', { name: '杭州演出海报' }).getAttribute('src')).toBe('/uploads/images/poster.png')
  expect(screen.getByRole('link', { name: '查看杭州演出海报原图' }).getAttribute('href')).toBe('/uploads/images/poster.png')
  expect(screen.getByRole('link', { name: '购票 / 报名' }).getAttribute('href')).toBe('https://example.com/tickets')
})
