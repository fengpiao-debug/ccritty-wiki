import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MusicPage } from './MusicPage'

const fixture = vi.hoisted(() => ({ songs: [] }))
const player = vi.hoisted(() => ({ currentSong: null, playSongs: vi.fn() }))
vi.mock('./useContent', () => ({ useContent: () => ({ content: fixture }) }))
vi.mock('../player/PlayerContext', () => ({ usePlayer: () => player }))
beforeEach(() => {
  player.playSongs.mockClear()
  fixture.songs = [
    { id: 'a', title: '第一首', artist: 'CC / 阿杰', album: '秋日', lyrics: '[00:01]清风入梦', cover: '/cover.jpg', audioUrl: '/a.mp3', mvUrl: 'https://www.bilibili.com/video/BV1xx411c7mD' },
    { id: 'b', title: '第二首', artist: 'CC', album: '秋日', audioUrl: '/b.mp3' },
    { id: 'c', title: '无音源歌曲', artist: 'CC', album: '冬日', audioUrl: '' },
  ]
})
afterEach(cleanup)
it('searches by co-singer and lyrics and displays small covers and disabled MV buttons', () => {
  render(<MusicPage />)
  expect(screen.getByAltText('第一首封面')).toBeTruthy()
  expect(screen.getByRole('link', { name: '观看 第一首 MV' }).href).toContain('bilibili.com/video/')
  expect(screen.getByRole('button', { name: '第二首 暂无 MV' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('搜索歌曲'), { target: { value: '阿杰 清风' } })
  expect(screen.getByRole('button', { name: '播放 第一首' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '播放 第二首' })).toBeNull()
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
