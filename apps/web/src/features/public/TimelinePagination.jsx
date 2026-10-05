import { useEffect, useRef } from 'react'

export function TimelinePagination({ label, entries, total, loading, loadingMore, error, hasMore, loadMore }) {
  const sentinelRef = useRef(null)
  const count = entries.length
  const canLoad = hasMore && !loading && !loadingMore && !error
  useEffect(() => {
    if (!canLoad || !count || !sentinelRef.current || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((observations) => {
      if (observations.some((entry) => entry.isIntersecting)) loadMore()
    }, { rootMargin: '400px 0px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [canLoad, count, loadMore])

  return <div className="timeline-pagination" ref={sentinelRef}>
    {error ? <><p role="alert">{count ? '后续内容加载失败，已加载内容仍可阅读。' : `${label}加载失败，请重试。`}</p><button type="button" onClick={loadMore}>重新加载</button></>
      : loadingMore ? <p role="status">正在加载更多{label}…</p>
        : !loading && hasMore ? <><p>已显示 {count} / {total} 条</p><button type="button" onClick={loadMore}>加载更多{label}</button></>
          : !loading && count > 0 ? <p>已显示全部{label}</p> : null}
  </div>
}
