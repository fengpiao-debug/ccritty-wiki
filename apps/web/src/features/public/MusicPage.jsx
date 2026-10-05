import { useMemo, useState } from 'react'
import { Disc3, Plus, Play, Search, X } from 'lucide-react'
import { matchesSong, safeMvUrl } from '@artist-wiki/content-types'
import { useContent } from './useContent'
import { usePlayer } from '../player/PlayerContext'
import { PageHeading } from './NewsPage'
import { SearchHighlight } from '../../components/SearchHighlight'
import { LyricsSearchExcerpt } from '../../components/LyricsSearchExcerpt'

const albumName = (song) => song.album?.trim() || '未归入专辑'
export function MusicPage() {
  const { content } = useContent()
  const player = usePlayer()
  const [query, setQuery] = useState('')
  const [view, setView] = useState('songs')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const albums = useMemo(() => {
    const grouped = new Map()
    for (const song of content.songs) {
      const name = albumName(song)
      if (!grouped.has(name)) grouped.set(name, { name, songs: [], cover: '' })
      const album = grouped.get(name)
      album.songs.push(song)
      if (!album.cover) album.cover = song.cover || song.coverUrl || ''
    }
    return [...grouped.values()]
  }, [content.songs])
  const albumSongs = selectedAlbum === null ? content.songs : content.songs.filter((song) => albumName(song) === selectedAlbum)
  const visible = albumSongs.filter((song) => matchesSong(song, query))
  const visibleAlbums = albums.filter((album) => album.songs.some((song) => matchesSong(song, query)))
  const showAlbums = view === 'albums' && selectedAlbum === null
  return <div className="content-page music-page">
    <PageHeading title="作品" subtitle="Music & Discography" />
    <div className="album-tools"><div className="album-filters" aria-label="作品浏览方式">
      <button type="button" aria-pressed={view === 'songs'} onClick={() => { setView('songs'); setSelectedAlbum(null) }}>全部歌曲</button>
      <button type="button" aria-pressed={view === 'albums'} onClick={() => { setView('albums'); setSelectedAlbum(null) }}>按专辑浏览</button>
    </div><label className="album-search"><Search size={18} /><input aria-label="搜索歌曲" placeholder="搜索歌名、歌手、专辑、歌词…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" className="album-icon" aria-label="清空歌曲搜索" onClick={() => setQuery('')}><X size={16} /></button>}</label></div>
    {albums.length > 0 && <section className="music-album-filter" aria-label="专辑筛选">
      <div className="music-album-options" role="group" aria-label="按专辑筛选歌曲">
        <button type="button" aria-pressed={selectedAlbum === null} onClick={() => setSelectedAlbum(null)}>全部专辑</button>
        {albums.map((album) => <button type="button" key={album.name} aria-pressed={selectedAlbum === album.name}
          aria-label={`筛选专辑 ${album.name}`} onClick={() => { setView('songs'); setSelectedAlbum(album.name) }}>{album.name}</button>)}
      </div>
    </section>}
    {showAlbums ? <>
      <p className="album-results" role="status">共 {visibleAlbums.length} 张专辑</p>
      <div className="music-albums">{visibleAlbums.map((album) => <article className="music-album-card" key={album.name}>
        <button type="button" className="music-album-open" aria-label={'浏览专辑 ' + album.name} onClick={() => setSelectedAlbum(album.name)}>
          <div className="music-album-art">{album.cover ? <img src={album.cover} alt="" loading="lazy" /> : <Disc3 size={60} strokeWidth={1} />}</div>
          <h2><SearchHighlight query={query}>{album.name}</SearchHighlight></h2><p>{album.songs.length} 首歌曲</p>
        </button>
        <button type="button" className="subtle-button compact" aria-label={'播放专辑 ' + album.name} disabled={!album.songs.some((song) => song.audioUrl)} onClick={() => player.playSongs(album.songs)}><Play size={14} />播放专辑</button>
      </article>)}</div>
      {!visibleAlbums.length && <p className="empty-copy">没有找到匹配的专辑，试试其他关键词。</p>}
    </> : <>
      <div className="music-list-heading"><div>{selectedAlbum !== null && <><button type="button" className="text-link" onClick={() => setSelectedAlbum(null)}>{view === 'albums' ? '← 返回专辑' : '← 查看全部歌曲'}</button><h2><SearchHighlight query={query}>{selectedAlbum}</SearchHighlight></h2></>}<p role="status">共 {visible.length} 首歌曲{query && ' · 搜索结果'}</p></div>
        <button type="button" className="subtle-button compact" disabled={!(selectedAlbum !== null ? albumSongs : visible).some((song) => song.audioUrl)} onClick={() => player.playSongs(selectedAlbum !== null ? albumSongs : visible)}><Play size={15} />{selectedAlbum !== null ? '播放整张专辑' : '播放全部'}</button>
      </div>
      {player.nextSong && <p className="music-next-notice" role="status">下一首播放：{player.nextSong.title}</p>}
      <div className="music-list">{visible.map((song) => {
        const current = player.currentSong?.id === song.id
        const mv = safeMvUrl(song.mvUrl)
        return <article className={'music-row catalog-song-row' + (current ? ' is-current' : '')} key={song.id}>
          <div className="music-song-cover">{song.cover || song.coverUrl ? <img src={song.cover || song.coverUrl} alt={song.title + '封面'} loading="lazy" /> : <Disc3 size={25} strokeWidth={1} />}</div>
          <div className="music-song-copy"><h2><SearchHighlight query={query}>{song.title}</SearchHighlight></h2><p><SearchHighlight query={query}>{song.artist || '歌手待补充'}</SearchHighlight> · <button type="button" className="music-album-link" onClick={() => { setView('albums'); setSelectedAlbum(albumName(song)); setQuery('') }}><SearchHighlight query={query}>{albumName(song)}</SearchHighlight></button></p>{song.releasedAt && <time className="music-song-date"><SearchHighlight query={query}>{song.releasedAt}</SearchHighlight></time>}</div>
          <div className="music-song-actions">{mv ? <a className="music-mv" href={mv} target="_blank" rel="noreferrer" aria-label={'观看 ' + song.title + ' MV'}>MV ↗</a> : <button type="button" className="music-mv" disabled aria-label={song.title + ' 暂无 MV'} title="暂无 MV">MV</button>}
            <button type="button" className="music-play-next" disabled={!song.audioUrl || current} aria-label={'下一首播放 ' + song.title} aria-pressed={player.nextSongId === song.id} title={!song.audioUrl ? '暂无音源' : current ? '正在播放这首歌' : player.nextSongId === song.id ? '已设为下一首' : '下一首播放'} onClick={() => player.playNext(song)}><Plus size={16} /><span>下一首播放</span></button>
            <button type="button" className="play-circle" disabled={!song.audioUrl} title={song.audioUrl ? '播放歌曲' : '暂无音源'} onClick={() => player.playSongs(visible, song.id)} aria-label={'播放 ' + song.title}><Play size={16} /></button>
          </div>
          <LyricsSearchExcerpt lyrics={song.lyrics} query={query} />
        </article>
      })}</div>
      {!visible.length && <p className="empty-copy">没有找到匹配的歌曲，试试歌名、合唱歌手或一段歌词。</p>}
    </>}
  </div>
}
