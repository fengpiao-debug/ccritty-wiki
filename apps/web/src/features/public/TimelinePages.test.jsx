// 验证时间线搜索、排序和图片展示，使用模拟内容，避免修改真实资料。
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render as renderView, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NewsPage } from './NewsPage'
import { EventsPage } from './EventsPage'

const fixture = vi.hoisted(() => ({ content: { news: [], events: [] }, loading: false }))
vi.mock('./useContent', () => ({ useContent: () => fixture }))
beforeEach(() => {
  fixture.content = { news: [], events: [] }; fixture.loading = false
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open') } })
})
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close })
const render = (ui, path = '/') => renderView(ui, { wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter> })

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
  expect(screen.getByRole('button', { name: '查看杭州演出海报原图' }).getAttribute('aria-haspopup')).toBe('dialog')
  expect(screen.getByRole('link', { name: '购票 / 报名' }).getAttribute('href')).toBe('https://example.com/tickets')
})

const timelines = [
  { label: '动态', key: 'news', dateField: 'publishedAt', Page: NewsPage, unit: '条' },
  { label: '活动', key: 'events', dateField: 'startsAt', Page: EventsPage, unit: '场' },
]
const titles = () => screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)

it.each(timelines)('$label图片在当前页面预览，图片点击不关闭，背景、关闭按钮和 Escape 均可退出', ({ key, Page }) => {
  fixture.content[key] = [{ id: 'photo', title: '预览测试', cover: '/uploads/images/preview.png' }]
  const view = render(<Page />)
  const trigger = screen.getByRole('button', { name: /查看预览测试.*原图/ })
  const previousOverflow = document.body.style.overflow
  for (const closeBy of ['background', 'button', 'escape']) {
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: /图片预览：预览测试/ })
    const image = within(dialog).getByRole('img')
    expect(image.getAttribute('src')).toBe('/uploads/images/preview.png')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(image)
    expect(screen.getByRole('dialog')).toBe(dialog)
    if (closeBy === 'background') fireEvent.click(dialog)
    else if (closeBy === 'button') fireEvent.click(within(dialog).getByRole('button', { name: '关闭图片预览' }))
    else fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe(previousOverflow)
    expect(document.activeElement).toBe(trigger)
  }
  fireEvent.click(trigger)
  fireEvent.error(within(screen.getByRole('dialog')).getByRole('img'))
  expect(screen.getByRole('alert').textContent).toContain('图片暂时无法加载')
  view.unmount()
  expect(document.body.style.overflow).toBe(previousOverflow)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('待官宣活动无论有无日期都置顶，两组内按所选时间排序且不修改源数据', () => {
  fixture.content.events = [
    { id: 'normal-new', title: '已官宣新场次', startsAt: '2027-01-01', status: 'upcoming' },
    { id: 'pending-unknown', title: '未定日期场次', startsAt: '', status: 'pending' },
    { id: 'pending-old', title: '较早拟定场次', startsAt: '2026-01-01', status: 'pending' },
    { id: 'normal-unknown', title: '普通无日期场次' },
    { id: 'pending-new', title: '较晚拟定场次', startsAt: '2026-02-01', status: 'pending' },
    { id: 'normal-old', title: '已官宣旧场次', startsAt: '2025-01-01', status: 'sold-out' },
  ]
  const original = structuredClone(fixture.content.events)
  render(<EventsPage />)
  expect(titles()).toEqual(['较晚拟定场次', '较早拟定场次', '未定日期场次', '已官宣新场次', '已官宣旧场次', '普通无日期场次'])
  expect(screen.getAllByText('待定（待官宣）')).toHaveLength(3)
  expect(screen.getAllByText('审批已通过，尚未官宣；时间、地点等信息以官方公布为准。')).toHaveLength(3)
  const pending = screen.getByRole('heading', { name: '未定日期场次' }).closest('article')
  expect(within(pending).getByText('日期待定').closest('time').hasAttribute('datetime')).toBe(false)
  expect(within(screen.getByRole('heading', { name: '较早拟定场次' }).closest('article')).getByText(/拟定日期：/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['较早拟定场次', '较晚拟定场次', '未定日期场次', '已官宣旧场次', '已官宣新场次', '普通无日期场次'])
  expect(fixture.content.events).toEqual(original)
})

it('待官宣场次可组合状态搜索与标签筛选，官宣后恢复日期排序', () => {
  fixture.content.events = [
    { id: 'pending', title: '杭州拟定演出', city: '杭州', status: 'pending', startsAt: '2026-01-01', tags: ['现场'] },
    { id: 'normal', title: '南京官宣演出', status: 'upcoming', startsAt: '2027-01-01', tags: ['现场'] },
    { id: 'other', title: '其他拟定演出', status: 'pending', startsAt: 'invalid', tags: ['音乐节'] },
  ]
  const view = render(<EventsPage />)
  fireEvent.click(screen.getAllByRole('button', { name: '查看标签：现场' })[0])
  expect(titles()).toEqual(['杭州拟定演出', '南京官宣演出'])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '待官宣 杭州' } })
  expect(titles()).toEqual(['杭州拟定演出'])
  expect(screen.getByText('待官宣', { selector: 'mark' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '清空活动搜索' }))
  fixture.content.events = fixture.content.events.map((event) => event.id === 'pending' ? { ...event, status: 'upcoming' } : event)
  view.rerender(<EventsPage />)
  expect(titles()).toEqual(['南京官宣演出', '杭州拟定演出'])
  expect(screen.queryByText(/审批已通过/)).toBeNull()
  expect(screen.queryByText(/拟定日期：/)).toBeNull()
})

it('动态显示可搜索的类型标识，旧记录不凭空添加，保留来源和标签筛选', () => {
  fixture.content.news = [
    { id: 'song', title: '新曲消息', newsKind: '新歌发布', tags: ['国风'], sourceName: '官方微博', sourceUrl: 'https://example.com/source', publishedAt: '2026-10-03' },
    { id: 'mv', title: '影像消息', newsKind: 'MV发布', tags: ['国风'], publishedAt: '2026-10-04' },
    { id: 'custom', title: '特别消息', newsKind: '幕后花絮' },
    { id: 'legacy', title: '历史消息' },
    { id: 'empty', title: '清空标识', newsKind: '   ' },
  ]
  render(<NewsPage />)
  expect(screen.getByLabelText('动态标识：新歌发布').textContent).toBe('新歌发布')
  expect(screen.getByLabelText('动态标识：MV发布').textContent).toBe('MV发布')
  expect(screen.getByLabelText('动态标识：幕后花絮').textContent).toBe('幕后花絮')
  expect(screen.getAllByLabelText(/^动态标识：/)).toHaveLength(3)
  expect(screen.getByText('官方微博')).toBeTruthy()
  expect(screen.getByRole('link', { name: '查看来源' }).getAttribute('href')).toBe('https://example.com/source')
  fireEvent.click(screen.getAllByRole('button', { name: '查看标签：国风' })[0])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '新歌发布' } })
  expect(titles()).toEqual(['新曲消息'])
  expect(screen.getByText('新歌发布', { selector: 'mark' })).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mv发布' } })
  expect(titles()).toEqual(['影像消息'])
})

it('点击动态标识精确筛选，同步选中状态并支持搜索、排序、标签和清除', () => {
  fixture.content.news = [
    { id: 'old', title: '成都旧消息', newsKind: ' 演出资讯 ', tags: ['现场'], publishedAt: '2025-01-01' },
    { id: 'new', title: '南京新消息', newsKind: '演出资讯', tags: ['南京'], publishedAt: '2026-01-01' },
    { id: 'other', title: '成都直播消息', newsKind: '线上演出资讯', tags: ['现场'], publishedAt: '2026-02-01' },
    { id: 'legacy', title: '未标注消息', markdown: '演出资讯' },
    { id: 'custom', title: '自定义消息', newsKind: '幕后 & 花絮' },
  ]
  const original = structuredClone(fixture.content.news)
  render(<NewsPage />)
  fireEvent.click(screen.getAllByRole('button', { name: '动态标识：演出资讯' })[0])
  expect(titles()).toEqual(['南京新消息', '成都旧消息'])
  const filter = screen.getByRole('group', { name: '动态标识筛选' })
  expect(within(filter).getByRole('button', { name: '演出资讯', exact: true }).getAttribute('aria-pressed')).toBe('true')
  for (const badge of screen.getAllByRole('button', { name: '动态标识：演出资讯' })) expect(badge.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('status').textContent).toBe('共 2 条动态 · 标识：演出资讯')
  fireEvent.click(screen.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['成都旧消息', '南京新消息'])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '南京' } })
  expect(titles()).toEqual(['南京新消息'])
  fireEvent.click(screen.getByRole('button', { name: '清空动态搜索' }))
  fireEvent.click(screen.getByRole('button', { name: '查看标签：现场' }))
  expect(titles()).toEqual(['成都旧消息'])
  fireEvent.click(screen.getByRole('button', { name: '全部标识' }))
  expect(titles()).toEqual(['成都旧消息', '成都直播消息'])
  fireEvent.click(screen.getByRole('button', { name: '全部标签' }))
  expect(titles()).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: '动态标识：幕后 & 花絮' }))
  expect(titles()).toEqual(['自定义消息'])
  expect(fixture.content.news).toEqual(original)
})

it('动态标识支持直接链接、独立清除和浏览器后退，保留标签与其他参数', async () => {
  fixture.content.news = [
    { id: 'match', title: '自定义消息', newsKind: '幕后 & 花絮', tags: ['现场'] },
    { id: 'tag', title: '仅标签匹配', newsKind: '演出资讯', tags: ['现场'] },
    { id: 'kind', title: '仅标识匹配', newsKind: '幕后 & 花絮' },
  ]
  function NavigationProbe() {
    const location = useLocation()
    const navigate = useNavigate()
    return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>后退</button></>
  }
  render(<><NewsPage /><NavigationProbe /></>, '/news?' + new URLSearchParams({ kind: '幕后 & 花絮', tag: '现场', ref: 'archive' }))
  expect(titles()).toEqual(['自定义消息'])
  fireEvent.click(screen.getByRole('button', { name: '全部标识' }))
  expect(titles()).toEqual(['自定义消息', '仅标签匹配'])
  let params = new URLSearchParams(screen.getByTestId('location').textContent)
  expect(params.has('kind')).toBe(false)
  expect(params.get('tag')).toBe('现场')
  expect(params.get('ref')).toBe('archive')
  fireEvent.click(screen.getByRole('button', { name: '后退' }))
  await waitFor(() => expect(titles()).toEqual(['自定义消息']))
  fireEvent.click(screen.getByRole('button', { name: '全部标签' }))
  expect(titles()).toEqual(['自定义消息', '仅标识匹配'])
  params = new URLSearchParams(screen.getByTestId('location').textContent)
  expect(params.get('kind')).toBe('幕后 & 花絮')
  expect(params.has('tag')).toBe(false)
})

it('不存在的动态标识显示空结果，清除后恢复无标识旧记录', () => {
  fixture.content.news = [{ id: 'legacy', title: '历史消息' }]
  render(<NewsPage />, '/news?kind=' + encodeURIComponent('已删除标识'))
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.getByRole('status').textContent).toBe('共 0 条动态 · 标识：已删除标识')
  expect(screen.getByText('没有找到匹配的动态，试试其他标识、标签或清空搜索。')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '全部标识' }))
  expect(titles()).toEqual(['历史消息'])
  expect(screen.queryByRole('group', { name: '动态标识筛选' })).toBeNull()
})

it('旧活动类型变成可点击标签，与新标签统一筛选且不重复展示', () => {
  fixture.content.events = [
    { id: 'legacy', title: '旧分类活动', startsAt: '2025-01-01', category: '拼盘演出', tags: [] },
    { id: 'both', title: '分类与标签都有', startsAt: '2025-02-01', category: '拼盘演出', tags: ['拼盘演出', '南京'] },
    { id: 'modern', title: '新标签活动', startsAt: '2025-03-01', tags: ['拼盘演出', '国风'] },
    { id: 'other', title: '不同分类活动', startsAt: '2025-04-01', category: '线上拼盘演出' },
  ]
  render(<EventsPage />)
  expect(screen.getAllByRole('button', { name: '查看标签：拼盘演出' })).toHaveLength(3)
  const legacyCard = screen.getByRole('heading', { name: '旧分类活动' }).closest('article')
  fireEvent.click(within(legacyCard).getByRole('button', { name: '查看标签：拼盘演出' }))
  expect(titles()).toEqual(['新标签活动', '分类与标签都有', '旧分类活动'])
  fireEvent.click(screen.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['旧分类活动', '分类与标签都有', '新标签活动'])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '南京' } })
  expect(titles()).toEqual(['分类与标签都有'])
})

it('直接访问旧活动类型的标签链接可以找到原有活动', () => {
  fixture.content.events = [{ id: 'legacy', title: '旧分类活动', category: '拼盘演出' }, { id: 'other', title: '其他活动', category: '其他' }]
  render(<EventsPage />, '/events?tag=' + encodeURIComponent('拼盘演出'))
  expect(titles()).toEqual(['旧分类活动'])
  expect(screen.getByRole('button', { name: '查看标签：拼盘演出' }).getAttribute('aria-pressed')).toBe('true')
})

it.each(timelines)('$label 点击内容标签进行精确筛选，可叠加搜索排序并清除', ({ label, key, dateField, Page }) => {
  fixture.content[key] = [
    { id: 'old', title: '南京旧记录', tags: ['音乐会', '南京'], [dateField]: '2025-01-01' },
    { id: 'new', title: '南京新记录', tags: ['音乐会', '现场'], [dateField]: '2026-01-01' },
    { id: 'other', title: '特别记录', tags: ['线上音乐会'], [dateField]: '2026-02-01' },
    { id: 'legacy', title: '旧版无标签', [dateField]: '2024-01-01' },
  ]
  render(<Page />)
  fireEvent.click(screen.getAllByRole('button', { name: '查看标签：音乐会' })[0])
  expect(titles()).toEqual(['南京新记录', '南京旧记录'])
  const filter = screen.getByRole('group', { name: `${label}标签筛选` })
  expect(within(filter).getByRole('button', { name: '音乐会', exact: true }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['南京旧记录', '南京新记录'])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '现场' } })
  expect(titles()).toEqual(['南京新记录'])
  fireEvent.click(screen.getByRole('button', { name: `清空${label}搜索` }))
  expect(titles()).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: '全部标签' }))
  expect(titles()).toHaveLength(4)
})

it('标签链接可跨动态和活动跳转并保留筛选', () => {
  fixture.content.news = [{ id: 'n1', title: '动态一', tags: ['音乐会 & 现场'] }]
  fixture.content.events = [{ id: 'e1', title: '活动一', tags: ['音乐会 & 现场'] }, { id: 'e2', title: '无关活动' }]
  render(<Routes><Route path="/news" element={<NewsPage />} /><Route path="/events" element={<EventsPage />} /></Routes>, '/news?tag=' + encodeURIComponent('音乐会 & 现场'))
  expect(titles()).toEqual(['动态一'])
  fireEvent.click(screen.getByRole('link', { name: '查看同标签活动 →' }))
  expect(titles()).toEqual(['活动一'])
  fireEvent.click(screen.getByRole('link', { name: '查看同标签动态 →' }))
  expect(titles()).toEqual(['动态一'])
})

it.each(timelines)('$label 直接访问不存在的标签时显示空结果，可恢复全部内容', ({ Page, key }) => {
  fixture.content[key] = [{ id: 'legacy', title: '历史记录', tags: '音乐会，现场，现场' }]
  render(<Page />, '/?tag=不存在')
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.getByRole('status').textContent).toContain('标签：不存在')
  fireEvent.click(screen.getByRole('button', { name: '全部标签' }))
  expect(titles()).toEqual(['历史记录'])
  expect(screen.getAllByRole('button', { name: '查看标签：现场' })).toHaveLength(1)
})

it.each(timelines)('$label 使用一个按钮切换时间正反序，日期待定始终置后且不修改源数据', ({ label, key, dateField, Page }) => {
  fixture.content[key] = [
    { id: 'old', title: '较早记录', [dateField]: '2025-09-14' },
    { id: 'unknown', title: '无效日期记录', [dateField]: 'invalid' },
    { id: 'new', title: '最新记录', [dateField]: '2025-11-22T15:00:00Z' },
    { id: 'missing', title: '缺失日期记录' },
    { id: 'middle', title: '中间记录', [dateField]: '2025-11-22T20:00:00+08:00' },
    { id: 'same', title: '同一时间记录', [dateField]: '2025-11-22T15:00:00Z' },
  ]
  const original = structuredClone(fixture.content[key])
  render(<Page />)
  const sortGroup = screen.getByRole('group', { name: `${label}时间排序` })
  expect(within(sortGroup).getAllByRole('button')).toHaveLength(1)
  const toggle = within(sortGroup).getByRole('button', { name: '最新' })
  expect(toggle.title).toBe('点击切换为最早在前')
  expect(titles()).toEqual(['最新记录', '同一时间记录', '中间记录', '较早记录', '无效日期记录', '缺失日期记录'])
  for (const node of screen.getAllByText('日期待定')) expect(node.closest('time').hasAttribute('datetime')).toBe(false)

  fireEvent.click(toggle)
  expect(within(sortGroup).getByRole('button', { name: '最早' })).toBe(toggle)
  expect(toggle.title).toBe('点击切换为最新在前')
  expect(titles()).toEqual(['较早记录', '中间记录', '最新记录', '同一时间记录', '无效日期记录', '缺失日期记录'])
  fireEvent.click(toggle)
  expect(within(sortGroup).getByRole('button', { name: '最新' })).toBe(toggle)
  expect(titles()[0]).toBe('最新记录')
  expect(fixture.content[key]).toEqual(original)
})

it.each(timelines)('$label 支持多个关键词跨字段搜索，排序保留筛选，清空恢复列表', ({ label, key, dateField, Page, unit }) => {
  fixture.content[key] = [
    { id: 'old', title: 'Critty 较早演出', markdown: '限定曲目：轮回之境', [dateField]: '2025-09-14' },
    { id: 'other', title: '其他消息', markdown: '日常分享', [dateField]: '2026-01-01' },
    { id: 'new', title: 'Critty 最新演出', markdown: '曲目：轮回之境', [dateField]: '2025-11-22' },
  ]
  render(<Page />)
  const input = screen.getByRole('searchbox', { name: `搜索${label}` })
  fireEvent.change(input, { target: { value: '  ＣＲＩＴＴＹ   轮回之境 ' } })
  expect(titles()).toEqual(['Critty 最新演出', 'Critty 较早演出'])
  expect(screen.getByRole('status').textContent).toBe(`共 2 ${unit}${label} · 搜索结果`)
  expect(screen.getAllByText('Critty', { selector: 'mark' })).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: '最新' }))
  expect(titles()).toEqual(['Critty 较早演出', 'Critty 最新演出'])
  expect(input.value).toBe('  ＣＲＩＴＴＹ   轮回之境 ')
  fireEvent.change(input, { target: { value: '不存在的消息' } })
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.getByText(`没有找到匹配的${label}，试试其他关键词。`)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: `清空${label}搜索` }))
  expect(input.value).toBe('')
  expect(titles()).toEqual(['Critty 较早演出', 'Critty 最新演出', '其他消息'])
  expect(screen.queryByText('Critty', { selector: 'mark' })).toBeNull()
  fireEvent.change(input, { target: { value: '   ' } })
  expect(titles()).toHaveLength(3)
  expect(screen.getByRole('status').textContent).toBe(`共 3 ${unit}${label}`)
})

it('动态可按来源、正文及原始或展示日期搜索', () => {
  fixture.content.news = [
    { id: 'matching', title: '新曲发布', sourceName: '官方微博', markdown: '试听片段', publishedAt: '2025-09-14' },
    { id: 'other', title: '其他消息', publishedAt: '2026-01-01' },
  ]
  render(<NewsPage />)
  const input = screen.getByRole('searchbox', { name: '搜索动态' })
  for (const query of ['官方微博', '试听片段', '2025-09-14', '2025/09/14']) {
    fireEvent.change(input, { target: { value: query } })
    expect(titles()).toEqual(['新曲发布'])
  }
})

it('活动可按城市、场地、分类、曲目及日期搜索', () => {
  fixture.content.events = [
    { id: 'matching', title: '良辰音乐会', city: '南京', venue: '太阳宫剧场', category: '拼盘演出', markdown: '歌单：宿命', startsAt: '2025-09-14' },
    { id: 'other', title: '其他活动', city: '杭州', startsAt: '2026-01-01' },
  ]
  render(<EventsPage />)
  const input = screen.getByRole('searchbox', { name: '搜索活动' })
  for (const query of ['南京', '太阳宫', '拼盘演出', '宿命', '2025-09-14', '2025/09/14', '南京 宿命']) {
    fireEvent.change(input, { target: { value: query } })
    expect(titles()).toEqual(['良辰音乐会'])
  }
})

it('空活动列表区分加载中和暂无内容', () => {
  fixture.loading = true
  const view = render(<EventsPage />)
  expect(screen.getByRole('status').textContent).toBe('正在加载活动…')
  expect(screen.queryByText('暂无活动，新的行程将在这里记录。')).toBeNull()
  fixture.loading = false
  view.rerender(<EventsPage />)
  expect(screen.getByText('暂无活动，新的行程将在这里记录。')).toBeTruthy()
})
