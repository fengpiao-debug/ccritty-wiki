// 文件作用：apps/web/src/features/public/MusicPage.jsx，负责公开 Wiki 内容展示。
import { Play } from 'lucide-react'
import { useContent } from './useContent'
import { usePlayer } from '../player/PlayerContext'
import { PageHeading } from './NewsPage'

export function MusicPage() {
  const { content } = useContent()
  const player = usePlayer()
  return (
    <div className="content-page">
      <PageHeading number="06" title="作品" subtitle="Music & Discography" />
      <div className="music-list">
        {content.songs.map((song) => {
          const current = player.currentSong?.id === song.id
          return (
            <article className={`music-row ${current ? 'is-current' : ''}`} key={song.id}>
              <span className="music-index">{song.releasedAt?.slice(0, 4) || '—'}</span>
              <div><h2>{song.title}</h2><p>{song.artist} · {song.album}</p></div>
              <button className="play-circle" disabled={!song.audioUrl} onClick={() => player.playAt(player.queue.findIndex((item) => item.id === song.id))} aria-label={`播放 ${song.title}`}><Play size={16} /></button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
