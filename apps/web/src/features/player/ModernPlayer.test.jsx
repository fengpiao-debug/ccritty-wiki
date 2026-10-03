// 文件作用：验证第三方播放引擎的单实例、页面控制桥接、进度歌词、错误状态和空队列。
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom'
import { ModernPlayer } from './ModernPlayer'
import { PlayerProvider, usePlayer } from './PlayerContext'

const fixture = vi.hoisted(() => ({ songs: [] }))
vi.mock('../public/useContent', () => ({ useContent: () => ({ content: fixture }) }))

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  HTMLElement.prototype.scrollTo = vi.fn()
  HTMLMediaElement.prototype.load = vi.fn()
  HTMLMediaElement.prototype.play = vi.fn(function () {
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  })
  HTMLMediaElement.prototype.pause = vi.fn(function () { this.dispatchEvent(new Event('pause')) })
})
beforeEach(() => {
  fixture.songs = [
    { id: 'song-a', title: '测试歌曲甲', artist: '测试歌手', audioUrl: '/test-a.mp3', lyrics: '[00:00.00]第一行\n[00:10.00]第二行' },
    { id: 'song-b', title: '测试歌曲乙', artist: '测试歌手', audioUrl: '/test-b.mp3', lyrics: '' },
  ]
})
afterEach(cleanup)

function Probe() {
  const player = usePlayer()
  return <><button onClick={() => player.playAt(1)}>页面选歌</button>
    <button onClick={() => player.playNext(fixture.songs[0])}>首曲下一首播放</button>
    <button onClick={() => player.playNext({ id: 'silent', title: '无音源' })}>无音源下一首播放</button>
    <button onClick={() => player.playSongs([fixture.songs[1], { id: "silent", title: "无音源" }])}>播放单曲专辑</button><button onClick={() => player.playSongs([fixture.songs[1], fixture.songs[0]], fixture.songs[0].id)}>切换专辑并选第二首</button><span data-testid="queue">{player.queue.map((song) => song.id).join(",")}</span><span data-testid="state">{JSON.stringify({ song: player.currentSong?.id, ...player.state })}</span></>
}
function App() {
  return <MemoryRouter><PlayerProvider>
    <Link to="/admin">后台</Link><Link to="/">首页</Link>
    <Routes><Route path="*" element={<Probe />} /></Routes>
    <ModernPlayer />
  </PlayerProvider></MemoryRouter>
}
const state = () => JSON.parse(screen.getByTestId('state').textContent)

describe('播放器接入', () => {
  it('移动已播放的歌曲到下一首，保留进度、播放状态和同一音频实例且不重复添加', async () => {
    const view = render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByText('页面选歌'))
    await waitFor(() => expect(state().song).toBe('song-b'))
    const audio = document.querySelector('audio')
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 4 })
    act(() => { audio.currentTime = 12; audio.dispatchEvent(new Event('timeupdate')) })
    const playCalls = HTMLMediaElement.prototype.play.mock.calls.length
    const pauseCalls = HTMLMediaElement.prototype.pause.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    fireEvent.click(screen.getByRole('button', { name: '下一首播放 测试歌曲甲' }))
    await waitFor(() => expect(screen.getByTestId('queue').textContent).toBe('song-b,song-a'))
    expect(state().song).toBe('song-b')
    expect(state().isPlaying).toBe(true)
    expect(state().currentTime).toBe(12)
    expect(audio.currentTime).toBe(12)
    expect(audio.src).toContain('test-b.mp3')
    expect(HTMLMediaElement.prototype.play.mock.calls.length).toBe(playCalls)
    expect(HTMLMediaElement.prototype.pause.mock.calls.length).toBe(pauseCalls)
    fireEvent.click(screen.getByRole('button', { name: '下一首播放 测试歌曲甲' }))
    expect(screen.getByTestId('queue').textContent).toBe('song-b,song-a')
    fixture.songs = fixture.songs.map((song) => ({ ...song }))
    view.rerender(<App />)
    expect(screen.getByTestId('queue').textContent).toBe('song-b,song-a')
    expect(state().song).toBe('song-b')
    fireEvent.ended(audio)
    await waitFor(() => expect(audio.src).toContain('test-a.mp3'))
    expect(state().song).toBe('song-a')
    expect(screen.queryByText('下一首播放：测试歌曲甲')).toBeNull()
    expect(document.querySelector('audio')).toBe(audio)
  })

  it.each(['single', 'shuffle'])('指定下一首优先于 %s 模式，播放后保留原模式', async (mode) => {
    fixture.songs.push({ id: 'song-c', title: '测试歌曲丙', audioUrl: '/test-c.mp3' })
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: All tracks' }))
    if (mode === 'shuffle') {
      fireEvent.click(screen.getByRole('button', { name: 'Repeat: One track' }))
      fireEvent.click(screen.getByRole('button', { name: 'Repeat: Off' }))
    }
    expect(state().mode).toBe(mode)
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    fireEvent.click(screen.getByRole('button', { name: '下一首播放 测试歌曲丙' }))
    expect(screen.getByTestId('queue').textContent).toBe('song-a,song-c,song-b')
    expect(state().song).toBe('song-a')
    expect(state().mode).toBe(mode)
    fireEvent.ended(document.querySelector('audio'))
    await waitFor(() => expect(state().song).toBe('song-c'))
    expect(state().mode).toBe(mode)
    expect(state().isPlaying).toBe(true)
    expect(screen.queryByText('下一首播放：测试歌曲丙')).toBeNull()
    if (mode === 'single') {
      fireEvent.ended(document.querySelector('audio'))
      expect(state().song).toBe('song-c')
    }
  })

  it('手动下一首也遵守指定顺序，暂停时不会自动播放', async () => {
    fixture.songs.push({ id: 'song-c', title: '测试歌曲丙', audioUrl: '/test-c.mp3' })
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: All tracks' }))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: One track' }))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: Off' }))
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    fireEvent.click(screen.getByRole('button', { name: '下一首播放 测试歌曲丙' }))
    const playCalls = HTMLMediaElement.prototype.play.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }))
    await waitFor(() => expect(state().song).toBe('song-c'))
    expect(state().mode).toBe('shuffle')
    expect(state().isPlaying).toBe(false)
    expect(HTMLMediaElement.prototype.play.mock.calls.length).toBe(playCalls)
  })

  it('可将队列外的歌曲加入下一首，跳过无音源，切换专辑后清除指定下一首', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByText('播放单曲专辑'))
    await waitFor(() => expect(state().song).toBe('song-b'))
    fireEvent.click(screen.getByText('首曲下一首播放'))
    expect(screen.getByTestId('queue').textContent).toBe('song-b,song-a')
    expect(state().song).toBe('song-b')
    fireEvent.click(screen.getByText('无音源下一首播放'))
    expect(screen.getByTestId('queue').textContent).toBe('song-b,song-a')
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    expect(screen.getByText('下一首播放：测试歌曲甲')).toBeTruthy()
    fireEvent.click(screen.getByText('播放单曲专辑'))
    expect(screen.queryByText('下一首播放：测试歌曲甲')).toBeNull()
    expect(screen.getByTestId('queue').textContent).toBe('song-b')
  })
  it('页面选歌与播放器同步，路由切换不重建音频', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    const audio = document.querySelector('audio')
    fireEvent.click(screen.getByText('页面选歌'))
    await waitFor(() => expect(audio.src).toContain('test-b.mp3'))
    expect(state().song).toBe('song-b')
    expect(state().isPlaying).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: '后台' }))
    expect(document.querySelector('audio')).toBe(audio)
    expect(document.querySelector('.modern-player-shell').hidden).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: '首页' }))
    expect(document.querySelectorAll('audio')).toHaveLength(1)
    expect(document.querySelector('audio')).toBe(audio)
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }))
    await waitFor(() => expect(state().isPlaying).toBe(false))
  })

  it('折叠保留音频、进度和播放状态，切换路由后可以展开', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    const audio = document.querySelector('audio')
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }))
    await waitFor(() => expect(state().isPlaying).toBe(true))
    act(() => { audio.currentTime = 12; audio.dispatchEvent(new Event('timeupdate')) })
    const pauseCalls = HTMLMediaElement.prototype.pause.mock.calls.length
    const toggle = screen.getByRole('button', { name: '收起播放器' })
    toggle.focus()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '展开播放器' })).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
    expect(screen.getByRole('button', { name: 'Pause', exact: true })).toBeTruthy()
    expect(document.querySelectorAll('audio')).toHaveLength(1)
    expect(document.querySelector('audio')).toBe(audio)
    expect(audio.currentTime).toBe(12)
    expect(state().isPlaying).toBe(true)
    expect(HTMLMediaElement.prototype.pause.mock.calls.length).toBe(pauseCalls)
    fireEvent.click(screen.getByRole('link', { name: '后台' }))
    expect(screen.queryByRole('button', { name: '展开播放器' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '首页' }))
    expect(screen.getByRole('button', { name: '展开播放器' })).toBe(toggle)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('audio')).toBe(audio)
    expect(audio.currentTime).toBe(12)
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }))
    await waitFor(() => expect(state().isPlaying).toBe(false))
  })

  it('折叠关闭歌词面板，收起期间页面选歌仍可同步', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    const audio = document.querySelector('audio')
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    expect(screen.getByRole('button', { name: '关闭播放器面板' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起播放器' }))
    fireEvent.click(screen.getByText('页面选歌'))
    await waitFor(() => expect(audio.src).toContain('test-b.mp3'))
    const expand = screen.getByRole('button', { name: '展开播放器' })
    expect(state().song).toBe('song-b')
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }))
    await waitFor(() => expect(state().isPlaying).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Previous track' }))
    await waitFor(() => expect(audio.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }))
    await waitFor(() => expect(audio.src).toContain('test-b.mp3'))
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }))
    await waitFor(() => expect(state().isPlaying).toBe(true))
    fireEvent.click(expand)
    expect(screen.queryByRole('button', { name: '关闭播放器面板' })).toBeNull()
    expect(screen.getByRole('button', { name: '播放列表和歌词' }).getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('audio')).toBe(audio)
    expect(state().isPlaying).toBe(true)
  })

  it('进度与歌词同步，点击歌词跳转，关闭面板恢复焦点', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    const audio = document.querySelector('audio')
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 })
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 4 })
    act(() => { audio.dispatchEvent(new Event('loadedmetadata')); audio.currentTime = 12; audio.dispatchEvent(new Event('timeupdate')) })
    fireEvent.click(screen.getByRole('button', { name: '播放列表和歌词' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '第二行' }).getAttribute('aria-current')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: '第一行' }))
    await waitFor(() => expect(audio.currentTime).toBe(0))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: '关闭播放器面板' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '播放列表和歌词' }))
  })

  it('播放模式、切歌和音量由同一个引擎控制', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: All tracks' }))
    await waitFor(() => expect(state().mode).toBe('single'))
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }))
    await waitFor(() => expect(state().song).toBe('song-b'))
    fireEvent.click(screen.getByRole('button', { name: 'Mute', exact: true }))
    await waitFor(() => expect(document.querySelector('audio').muted).toBe(true))
  })

  it('音频错误不会被下一次进度同步清除', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('test-a.mp3'))
    const audio = document.querySelector('audio')
    act(() => audio.dispatchEvent(new Event('error')))
    expect(screen.getByRole('status').textContent).toContain('音频无法播放')
    act(() => { audio.currentTime = 2; audio.dispatchEvent(new Event('timeupdate')) })
    expect(screen.getByRole('status').textContent).toContain('音频无法播放')
    act(() => audio.dispatchEvent(new Event('canplay')))
    expect(state().error).toBe('')
  })

  it('空队列保留空状态，禁止产生虚构音源', () => {
    fixture.songs = []
    render(<App />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('audio').getAttribute('src')).toBeNull()
  })
})

it("专辑队列切换后播放指定曲目，跳过无音源并保留同一音频实例", async () => {
  render(<App />)
  await waitFor(() => expect(document.querySelector("audio")?.src).toContain("test-a.mp3"))
  const audio = document.querySelector("audio")
  fireEvent.click(screen.getByText("播放单曲专辑"))
  await waitFor(() => expect(audio.src).toContain("test-b.mp3"))
  expect(screen.getByTestId("queue").textContent).toBe("song-b")
  expect(state().isPlaying).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Next track" }))
  expect(state().song).toBe("song-b")
  fireEvent.click(screen.getByText("切换专辑并选第二首"))
  await waitFor(() => expect(audio.src).toContain("test-a.mp3"))
  expect(screen.getByTestId("queue").textContent).toBe("song-b,song-a")
  expect(state().song).toBe("song-a")
  fireEvent.click(screen.getByRole("button", { name: "Next track" }))
  await waitFor(() => expect(state().song).toBe("song-b"))
  expect(document.querySelector("audio")).toBe(audio)
})
