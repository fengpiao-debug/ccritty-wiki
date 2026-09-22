// 文件作用：apps/web/src/features/player/PlayerContext.jsx，负责连接歌曲数据、歌词状态和第三方播放器控制器。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useContent } from '../public/useContent'
import { activeLyricIndex, parseLyrics } from './lyrics'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const { content } = useContent()
  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [state, setState] = useState({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    error: '',
    mode: 'sequence',
  })
  const controllerRef = useRef(null)

  useEffect(() => {
    const playable = (content.songs || []).filter((song) => song.audioUrl)
    setQueue(playable)
    setCurrentIndex((index) => Math.min(index, Math.max(playable.length - 1, 0)))
  }, [content.songs])

  const currentSong = queue[currentIndex] || null
  const lyricLines = useMemo(() => parseLyrics(currentSong?.lyrics || ''), [currentSong])
  const lyricIndex = activeLyricIndex(lyricLines, state.currentTime)

  const registerController = useCallback((controller) => {
    controllerRef.current = controller
    return () => {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [])

  const syncFromController = useCallback((nextState) => {
    setState((value) => ({
      ...value,
      isPlaying: nextState.isPlaying,
      currentTime: Number.isFinite(nextState.currentTime) ? nextState.currentTime : 0,
      duration: Number.isFinite(nextState.duration) ? nextState.duration : 0,
      mode: ({ ALL: 'sequence', ONE: 'single', SHUFFLE: 'shuffle', NONE: 'once' })[nextState.repeatType] || value.mode,
    }))
    if (Number.isInteger(nextState.currentIndex)) setCurrentIndex(nextState.currentIndex)
  }, [])

  const syncMediaStatus = useCallback((status) => {
    setState((value) => ({ ...value, ...status }))
  }, [])

  function playAt(index) {
    const song = queue[index]
    if (!song) return
    setCurrentIndex(index)
    controllerRef.current?.setTrack(index)
    controllerRef.current?.play()
  }

  function toggle() {
    if (!currentSong) return
    controllerRef.current?.togglePlay()
  }

  function next() {
    if (!queue.length) return
    controllerRef.current?.next()
  }

  function previous() {
    if (!queue.length) return
    controllerRef.current?.prev()
  }

  function seek(value) {
    if (!state.duration) return
    controllerRef.current?.seek(Math.min(Math.max(value, 0), state.duration))
  }

  function cycleMode() {
    controllerRef.current?.cycleRepeatType()
  }

  const value = {
    queue,
    currentSong,
    currentIndex,
    lyricLines,
    lyricIndex,
    state,
    playAt,
    toggle,
    next,
    previous,
    seek,
    cycleMode,
    registerController,
    syncFromController,
    syncMediaStatus,
  }
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}
