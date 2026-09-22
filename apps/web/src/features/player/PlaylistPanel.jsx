// 文件作用：apps/web/src/features/player/PlaylistPanel.jsx，负责全局音乐播放器的独立功能模块。
export function PlaylistPanel({ queue, currentIndex, onSelect }) {
  return (
    <section className="player-panel-section">
      <div className="player-section-heading">
        <span>播放列表</span>
        <small>{queue.length} 首</small>
      </div>
      <div className="playlist-list">
        {queue.map((song, index) => (
          <button
            key={song.id}
            type="button"
            className={`playlist-item ${index === currentIndex ? 'is-current' : ''}`}
            onClick={() => onSelect(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{song.title}</strong>
            <small>{song.artist}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
