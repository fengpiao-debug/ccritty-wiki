import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MusicPage } from './MusicPage'

const fixture = vi.hoisted(() => ({ songs: [] }))
const player = vi.hoisted(() => ({ currentSong: null, playSongs: vi.fn(), playNext: vi.fn(), nextSongId: null, nextSong: null }))
vi.mock('./useContent', () => ({ useContent: () => ({ content: fixture }) }))
vi.mock('../player/PlayerContext', () => ({ usePlayer: () => player }))
beforeEach(() => {
  player.playSongs.mockClear()
  player.playNext.mockClear()
  player.currentSong = null
  player.nextSongId = null
  player.nextSong = null
  fixture.songs = [
    { id: 'a', title: '第一首', artist: 'CC / 阿杰', album: '秋日', lyrics: '[00:01]清风入梦', cover: '/cover.jpg', audioUrl: '/a.mp3', mvUrl: 'https://www.bilibili.com/video/BV1xx411c7mD' },
    { id: 'b', title: '第二首', artist: 'CC', album: '秋日', audioUrl: '/b.mp3' },
    { id: 'c', title: '无音源歌曲', artist: 'CC', album: '冬日', audioUrl: '' },
  ]
})
afterEach(cleanup)
it('schedules a song to play next and disables unavailable or current tracks', () => {
  player.currentSong = fixture.songs[0]
  const { rerender } = render(<MusicPage />)
  expect(screen.getByRole('button', { name: '下一首播放 第一首' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '下一首播放 无音源歌曲' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '下一首播放 第二首' }))
  expect(player.playNext).toHaveBeenCalledWith(fixture.songs[1])
  expect(player.playSongs).not.toHaveBeenCalled()
  player.nextSongId = fixture.songs[1].id
  player.nextSong = fixture.songs[1]
  rerender(<MusicPage />)
  expect(screen.getByText('下一首播放：第二首')).toBeTruthy()
  expect(screen.getByRole('button', { name: '下一首播放 第二首' }).getAttribute('aria-pressed')).toBe('true')
})
it('highlights matching song and album text and clears it without changing playback labels', () => {
  fixture.songs[0].title = '轮回之境'
  fixture.songs[0].album = '轮回'
  const { container } = render(<MusicPage />)
  fireEvent.change(screen.getByLabelText('搜索歌曲'), { target: { value: '轮回' } })
  expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['轮回', '轮回'])
  expect(screen.getByRole('button', { name: '播放 轮回之境' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '按专辑浏览' }))
  expect(screen.getByRole('button', { name: '浏览专辑 轮回' }).querySelector('mark').textContent).toBe('轮回')
  fireEvent.click(screen.getByRole('button', { name: '清空歌曲搜索' }))
  expect(container.querySelector('mark')).toBeNull()
})
it('searches by co-singer and lyrics and displays small covers and disabled MV buttons', () => {
  const { container } = render(<MusicPage />)
  expect(screen.getByAltText('第一首封面')).toBeTruthy()
  expect(screen.getByRole('link', { name: '观看 第一首 MV' }).href).toContain('bilibili.com/video/')
  expect(screen.getByRole('button', { name: '第二首 暂无 MV' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('搜索歌曲'), { target: { value: '阿杰 清风' } })
  expect(screen.getByRole('button', { name: '播放 第一首' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '播放 第二首' })).toBeNull()
  expect(container.querySelector('.lyrics-search-excerpt').textContent).toBe('歌词：清风入梦')
  expect(container.querySelector('.lyrics-search-excerpt mark').textContent).toBe('清风')
  fireEvent.click(screen.getByRole('button', { name: '播放 第一首' }))
  expect(player.playSongs).toHaveBeenLastCalledWith([fixture.songs[0]], 'a')
  fireEvent.click(screen.getByRole('button', { name: '清空歌曲搜索' }))
  expect(container.querySelector('.lyrics-search-excerpt')).toBeNull()
  fireEvent.change(screen.getByLabelText('搜索歌曲'), { target: { value: '第一首' } })
  expect(container.querySelector('.lyrics-search-excerpt')).toBeNull()
})
it('keeps matching lyric excerpts when opening an album from search results', () => {
  const { container } = render(<MusicPage />)
  fireEvent.change(screen.getByLabelText('搜索歌曲'), { target: { value: '清风' } })
  fireEvent.click(screen.getByRole('button', { name: '按专辑浏览' }))
  fireEvent.click(screen.getByRole('button', { name: '浏览专辑 秋日' }))
  expect(container.querySelector('.lyrics-search-excerpt mark').textContent).toBe('清风')
})
it('browses album tracks and sends that album alone to the player', () => {
  render(<MusicPage />)
  fireEvent.click(screen.getByRole('button', { name: '按专辑浏览' }))
  expect(screen.getByRole('button', { name: '播放专辑 冬日' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '播放专辑 秋日' }))
  expect(player.playSongs.mock.calls[0][0].map((song) => song.id)).toEqual(['a', 'b'])
  fireEvent.click(screen.getByRole('button', { name: '浏览专辑 秋日' }))
  expect(screen.queryByRole('button', { name: '播放 无音源歌曲' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '播放 第二首' }))
  expect(player.playSongs).toHaveBeenLastCalledWith(fixture.songs.slice(0, 2), 'b')
})
