import { lyricsSearchExcerpt } from '../utils/searchText'
import { SearchHighlight } from './SearchHighlight'

export function LyricsSearchExcerpt({ lyrics, query }) {
  const excerpt = lyricsSearchExcerpt(lyrics, query)
  if (!excerpt) return null
  return <p className="lyrics-search-excerpt"><span className="lyrics-search-label">歌词：</span><SearchHighlight query={query}>{excerpt}</SearchHighlight></p>
}
