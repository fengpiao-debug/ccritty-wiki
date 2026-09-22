// 文件作用：桥接开源播放引擎与 Wiki 控制接口，监听原生音频缓冲、暂停和错误事件。
import { useContext, useEffect } from 'react'
import { audioPlayerDispatchContext, useAudioPlayer, useAudioPlayerElement } from 'react-modern-audio-player'
import { usePlayer } from './PlayerContext'

export function PlayerStateBridge() {
  const audio = useAudioPlayer()
  const { audioEl } = useAudioPlayerElement()
  const dispatch = useContext(audioPlayerDispatchContext)
  const { registerController, syncFromController, syncMediaStatus } = usePlayer()

  useEffect(() => registerController({
    ...audio,
    cycleRepeatType: () => dispatch({
      type: 'SET_REPEAT_TYPE',
      repeatType: ({ ALL: 'ONE', ONE: 'SHUFFLE', SHUFFLE: 'ALL', NONE: 'ALL' })[audio.repeatType],
    }),
  }), [audio, dispatch, registerController])

  useEffect(() => {
    syncFromController(audio)
  }, [audio.isPlaying, audio.currentTime, audio.duration, audio.currentIndex, audio.repeatType, syncFromController])

  useEffect(() => {
    if (!audioEl) return undefined
    const loading = () => syncMediaStatus({ isLoading: true, error: '' })
    const ready = () => syncMediaStatus({ isLoading: false, error: '' })
    const failed = () => {
      dispatch({ type: 'CHANGE_PLAYING_STATE', state: false })
      syncMediaStatus({ isLoading: false, isPlaying: false, error: '音频无法播放，请重试或切换歌曲' })
    }
    const stopped = () => syncMediaStatus({ isLoading: false })
    const events = { loadstart: loading, waiting: loading, playing: ready, canplay: ready, error: failed, pause: stopped }
    for (const [name, listener] of Object.entries(events)) audioEl.addEventListener(name, listener)
    if (audioEl.error) failed()
    return () => {
      for (const [name, listener] of Object.entries(events)) audioEl.removeEventListener(name, listener)
    }
  }, [audioEl, dispatch, syncMediaStatus])
  return <span className="player-state-bridge" hidden />
}
