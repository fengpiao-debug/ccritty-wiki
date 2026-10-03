import { searchMatchRanges } from '../utils/searchText'

// Map normalized matches back to the original text so full-width characters,
// ligatures and combining marks retain their original spelling and boundaries.
export function SearchHighlight({ children, query = '' }) {
  const text = String(children ?? '')
  const ranges = searchMatchRanges(text, query)
  if (!ranges.length) return text

  const parts = []
  let cursor = 0
  for (const { start, end } of ranges) {
    parts.push(text.slice(cursor, start))
    parts.push(<mark className="search-highlight" key={start}>{text.slice(start, end)}</mark>)
    cursor = end
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}
