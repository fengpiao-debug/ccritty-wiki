// 文件作用：适配站内歌曲数据并配置开源播放器底栏，保持音频实例跨路由挂载。
import { useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import AudioPlayer from 'react-modern-audio-player'
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, Volume1, VolumeX } from 'lucide-react'
import { usePlayer } from './PlayerContext'
import { PlayerStateBridge } from './PlayerStateBridge'
import { PlayerDrawer } from './PlayerDrawer'

const activeUI = { all: true, progress: 'bar', playList: false, playbackRate: false, volumeSlider: false }
const placement = {
  volumeSlider: 'top',
  interface: {
    templateArea: {
      playButton: 'row1-1', artwork: 'row1-2', trackInfo: 'row1-3',
      progress: 'row2-3', trackTimeCurrent: 'row2-4', trackTimeDuration: 'row2-5',
      repeatType: 'row1-6', volume: 'row1-7',
    },
    customComponentsArea: { drawer: 'row1-8', bridge: 'row2-8' },
  },
}
const icons = {
  play: <Play />, pause: <Pause />, prev: <SkipBack />, next: <SkipForward />,
  repeatOne: <Repeat1 />, repeatAll: <Repeat />, repeatNone: <Repeat />,
  repeatShuffle: <Shuffle />, volumeFull: <Volume2 />, volumeHalf: <Volume1 />, volumeMuted: <VolumeX />,
}

export function ModernPlayer() {
  const player = usePlayer()
  const location = useLocation()
  const ids = useRef(new Map())
  const playList = useMemo(() => player.queue.map((song) => {
    // 数据库使用字符串 ID；稳定映射为数字，避免刷新或排序后选中错误歌曲。
    if (!ids.current.has(song.id)) ids.current.set(song.id, ids.current.size + 1)
    return {
      id: ids.current.get(song.id), src: song.audioUrl, name: song.title,
      writer: song.artist || '未知歌手', img: song.cover || song.coverUrl || undefined,
      description: song.album || '', preload: 'metadata',
    }
  }), [player.queue])

  return (
    <div className="modern-player-shell" hidden={location.pathname.startsWith('/admin')}>
      <AudioPlayer playList={playList} colorScheme="light" activeUI={activeUI}
        placement={placement} customIcons={icons}
        rootContainerProps={{ className: 'modern-player' }}>
        <AudioPlayer.CustomComponent id="bridge"><PlayerStateBridge /></AudioPlayer.CustomComponent>
        <AudioPlayer.CustomComponent id="drawer"><PlayerDrawer /></AudioPlayer.CustomComponent>
      </AudioPlayer>
    </div>
  )
}
