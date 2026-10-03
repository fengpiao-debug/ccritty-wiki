const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const normalize = (text) => text.normalize('NFKC').toLocaleLowerCase()

// Keep offsets in the original text when normalization changes character width.
export function searchMatchRanges(text, query) {
  const words = [...new Set(normalize(String(query ?? '')).trim().split(/\s+/).filter(Boolean))]
  if (!text || !words.length) return []

  let normalized = ''
  const positions = []
  for (const { segment, index } of segmenter.segment(text)) {
    const value = normalize(segment)
    normalized += value
    for (let i = 0; i < value.length; i += 1) {
      positions.push({ start: index, end: index + segment.length })
    }
  }

  const ranges = []
  for (const word of words) {
    let from = 0
    let index
    while ((index = normalized.indexOf(word, from)) !== -1) {
      ranges.push({ start: positions[index].start, end: positions[index + word.length - 1].end })
      from = index + 1
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

export function lyricsSearchExcerpt(lyrics, query) {
  if (!String(query ?? '').trim()) return ''
  // Strip LRC timestamps and metadata just as song search does; plain lyrics work too.
  const text = String(lyrics ?? '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  const match = searchMatchRanges(text, query)[0]
  if (!match) return ''

  const characters = [...segmenter.segment(text)]
  const matchStart = characters.findIndex(({ index }) => index === match.start)
  const matchEnd = characters.findIndex(({ index }) => index >= match.end)
  const start = Math.max(0, matchStart - 16)
  // Keep the entire match, even for unusually long queries, plus nearby context.
  const end = Math.min(characters.length, Math.max(start + 80, (matchEnd < 0 ? characters.length : matchEnd) + 16))
  const excerpt = characters.slice(start, end).map(({ segment }) => segment).join('').trim()
  return `${start ? '…' : ''}${excerpt}${end < characters.length ? '…' : ''}`
}
