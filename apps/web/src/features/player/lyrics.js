// 文件作用：解析并排序 LRC 时间标签，按播放时间定位当前歌词行。
const timestampPattern = /\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

function timestampToSeconds(tag) {
  const milliseconds = Number((tag[3] || '0').padEnd(3, '0'))
  return Number(tag[1]) * 60 + Number(tag[2]) + milliseconds / 1000
}

export function parseLyrics(raw = '') {
  const lines = []
  String(raw).split(/\r?\n/).forEach((row) => {
    const tags = [...row.matchAll(timestampPattern)]
    const text = row.replace(timestampPattern, '').trim()
    if (!tags.length || !text) return
    // 逐字 LRC 会把时间戳穿插在文字之间；整行只保留一个起始时间，避免重复显示整句。
    const prefix = row.match(new RegExp(`^\\s*(?:${timestampPattern.source})+`))
    const prefixTags = prefix ? [...prefix[0].matchAll(timestampPattern)].length : 0
    const isWordTimed = tags.length > 1 && tags.length > prefixTags
    if (isWordTimed) {
      lines.push({ time: timestampToSeconds(tags[0]), text })
      return
    }
    tags.forEach((tag) => lines.push({ time: timestampToSeconds(tag), text }))
  })
  return lines.sort((a, b) => a.time - b.time)
}

export function activeLyricIndex(lines, time) {
  let index = -1
  lines.forEach((line, lineIndex) => {
    if (time >= line.time) index = lineIndex
  })
  return index
}
