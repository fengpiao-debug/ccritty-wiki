// 文件作用：提供队列与歌词双栏弹层，支持 Escape 关闭、焦点返回和移动端标签切换。
import { useEffect, useRef, useState } from 'react'
import { ListMusic, Repeat, Repeat1, Shuffle, Volume2, X } from 'lucide-react'
import { useAudioPlayerVolume } from 'react-modern-audio-player'
import { IconButton } from '../../components/IconButton'
import { usePlayer } from './PlayerContext'
import { LyricsPanel } from './LyricsPanel'
import { PlaylistPanel } from './PlaylistPanel'

export function PlayerDrawer({ collapsed = false }) {
  const player = usePlayer()
  const volume = useAudioPlayerVolume()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('playlist')
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  useEffect(() => {
    if (collapsed) setOpen(false)
  }, [collapsed])
  useEffect(() => {
    if (!open || collapsed) return undefined
    closeRef.current?.focus()
    const escape = (event) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, collapsed])

  return (
    <div className="player-drawer-control">
      <IconButton ref={triggerRef} label="播放列表和歌词" aria-expanded={open}
        aria-controls="player-drawer" onClick={() => setOpen((value) => !value)}>
        <ListMusic size={20} />
      </IconButton>
      {!open && (player.state.error || player.state.isLoading) && (
        <div className="player-status" role="status">
          {player.state.error || '音频加载中…'}
        </div>
      )}
      {open && (
        <section id="player-drawer" className={`player-drawer tab-${tab}`} aria-label="播放列表和歌词">
          <header className="player-drawer-header">
            <strong>播放列表 <small>({player.queue.length})</small></strong>
            <span title={player.currentSong?.title}>{player.currentSong?.title || '尚未选择歌曲'}</span>
            <IconButton ref={closeRef} label="关闭播放器面板"
              onClick={() => { setOpen(false); triggerRef.current?.focus() }}><X size={18} /></IconButton>
          </header>
          <div className="player-panel-tabs">
            <button type="button" aria-pressed={tab === 'playlist'} onClick={() => setTab('playlist')}>播放列表</button>
            <button type="button" aria-pressed={tab === 'lyrics'} onClick={() => setTab('lyrics')}>歌词</button>
          </div>
          {player.nextSong && <p className="player-next-notice" role="status">下一首播放：{player.nextSong.title}</p>}
          <div className="player-drawer-body">
            <PlaylistPanel queue={player.queue} currentIndex={player.currentIndex} onSelect={player.playAt} onPlayNext={player.playNext} nextSongId={player.nextSongId} />
            <LyricsPanel lines={player.lyricLines} activeIndex={player.lyricIndex} onSeek={player.seek} />
          </div>
          <footer className="player-drawer-settings">
            <IconButton label={({ sequence: '列表循环', single: '单曲循环', shuffle: '随机播放', once: '顺序播放' })[player.state.mode]}
              onClick={player.cycleMode}>
              {player.state.mode === 'single' ? <Repeat1 size={18} /> : player.state.mode === 'shuffle' ? <Shuffle size={18} /> : <Repeat size={18} />}
            </IconButton>
            <span>{({ sequence: '列表循环', single: '单曲循环', shuffle: '随机播放', once: '顺序播放' })[player.state.mode]}</span>
            <IconButton label={volume.muted ? '取消静音' : '静音'} onClick={volume.toggleMute}><Volume2 size={18} /></IconButton>
            <input aria-label="音量" type="range" min="0" max="1" step="0.01" value={volume.muted ? 0 : volume.volume}
              onChange={(event) => { if (volume.muted) volume.toggleMute(); volume.setVolume(Number(event.target.value)) }} />
          </footer>
          {player.state.error && <p className="player-panel-error" role="status">{player.state.error}</p>}
        </section>
      )}
    </div>
  )
}
