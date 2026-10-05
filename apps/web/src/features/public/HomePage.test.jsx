import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'
import { isUpcomingEvent } from '../../utils/events'

const fixture = vi.hoisted(() => ({ content: { profile: {}, news: [], songs: [], photos: [], events: [] }, loading: false }))
vi.mock('./useContent', () => ({ useContent: () => fixture }))
afterEach(cleanup)

it('9 场活动中 7 场已结束、2 场待官宣时，首页未来活动显示 2 并保留活动页入口', () => {
  fixture.content.events = [
    ...Array.from({ length: 7 }, (_, index) => ({ id: `ended-${index}`, status: 'ended', startsAt: '2025-01-01' })),
    { id: 'pending-one', status: 'pending', startsAt: '' },
    { id: 'pending-two', status: 'pending', startsAt: '' },
  ]
  render(<MemoryRouter><HomePage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /^2\s*未来活动$/ }).getAttribute('href')).toBe('/events')
  expect(fixture.content.events).toHaveLength(9)
})

it.each([
  ['已结束', { status: 'ended', startsAt: '2027-01-01' }, false],
  ['已取消', { status: 'cancelled', startsAt: '2027-01-01' }, false],
  ['未来已售罄', { status: 'sold-out', startsAt: '2027-01-01' }, true],
  ['已过期但未更新状态', { status: 'upcoming', startsAt: '2025-01-01' }, false],
  ['过去已售罄', { status: 'sold-out', startsAt: '2025-01-01' }, false],
  ['无日期待官宣', { status: 'pending' }, true],
  ['拟定日期已过但仍待官宣', { status: 'pending', startsAt: '2025-01-01' }, true],
  ['即将到来但日期未定', { status: 'upcoming', startsAt: '' }, true],
  ['无状态的未来活动', { startsAt: '2027-01-01' }, true],
  ['无日期无状态', {}, false],
  ['当天仅填写日期', { startsAt: '2026-10-05' }, true],
  ['当天已过的明确开始时间', { startsAt: '2026-10-05T09:00:00' }, false],
  ['当天未来的明确开始时间', { startsAt: '2026-10-05T19:30:00' }, true],
])('未来活动统计：%s', (_label, event, expected) => {
  expect(isUpcomingEvent(event, new Date('2026-10-05T12:00:00').getTime())).toBe(expected)
})
