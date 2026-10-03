// 文件作用：apps/web/src/features/player/PlaylistPanel.jsx，负责全局音乐播放器的独立功能模块。
import { Plus } from 'lucide-react'
import { IconButton } from '../../components/IconButton'

export function PlaylistPanel({ queue, currentIndex, onSelect, onPlayNext, nextSongId }) {
  return (
    <section className="player-panel-section">
      <div className="player-section-heading">
        <span>播放列表</span>
        <small>{queue.length} 首</small>
      </div>
      <div className="playlist-list">
        {queue.map((song, index) => (
          <div className="playlist-row" key={song.id}><button
            type="button"
            className={`playlist-item ${index === currentIndex ? 'is-current' : ''}`}
            onClick={() => onSelect(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{song.title}</strong>
            <small>{song.artist}</small>
          </button>
            <IconButton className="playlist-next-action" label={'下一首播放 ' + song.title} disabled={index === currentIndex || !song.audioUrl} aria-pressed={song.id === nextSongId} onClick={() => onPlayNext(song)}><Plus size={16} /></IconButton>
          </div>
        ))}
      </div>
    </section>
  )
}
