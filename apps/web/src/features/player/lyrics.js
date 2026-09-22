// 文件作用：解析并排序 LRC 时间标签，按播放时间定位当前歌词行。
export function parseLyrics(raw = '') {
  const lines = []
  String(raw).split(/\r?\n/).forEach((row) => {
    const tags = [...row.matchAll(/\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = row.replace(/\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    if (!tags.length || !text) return
    tags.forEach((tag) => {
      const milliseconds = Number((tag[3] || '0').padEnd(3, '0'))
      lines.push({ time: Number(tag[1]) * 60 + Number(tag[2]) + milliseconds / 1000, text })
    })
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
