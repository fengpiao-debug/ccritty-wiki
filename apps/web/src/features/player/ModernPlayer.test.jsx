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
    <span data-testid="state">{JSON.stringify({ song: player.currentSong?.id, ...player.state })}</span></>
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
