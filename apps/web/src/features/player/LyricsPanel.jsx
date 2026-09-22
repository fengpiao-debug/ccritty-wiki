// 文件作用：展示 LRC 歌词并将当前行滚动到面板中央，点击歌词可跳转到对应时间。
import { useEffect, useRef } from 'react'

export function LyricsPanel({ lines, activeIndex, onSeek }) {
  const listRef = useRef(null)
  useEffect(() => {
    const list = listRef.current
    const active = list?.children[activeIndex]
    if (active) list.scrollTo({
      top: active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [activeIndex, lines])
  return (
    <section className="player-panel-section lyrics-panel">
      <div className="player-section-heading"><span>歌词</span></div>
      <div className="lyrics-list" ref={listRef}>
        {lines.map((line, index) => (
          <button type="button" key={`${line.time}-${index}`} className={index === activeIndex ? 'is-active' : ''}
            aria-current={index === activeIndex ? 'true' : undefined} onClick={() => onSeek?.(line.time)}>{line.text}</button>
        ))}
        {!lines.length && <p className="empty-copy">暂无歌词</p>}
      </div>
    </section>
  )
}
