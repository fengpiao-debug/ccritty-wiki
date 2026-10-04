import { useId } from 'react'
import { NEWS_KIND_SUGGESTIONS, MAX_NEWS_KIND_LENGTH, normalizeNewsKind } from '@artist-wiki/content-types'

export function NewsKindField({ value, disabled, onChange }) {
  const id = useId()
  return <div className="full cms-news-kind-field">
    <label htmlFor={id}>动态标识
      <input id={id} value={value || ''} disabled={disabled} maxLength={MAX_NEWS_KIND_LENGTH} placeholder="例如：新歌发布、MV发布，也可自定义" aria-describedby={`${id}-help`} onChange={(event) => onChange(event.target.value)} />
    </label>
    <div className="cms-news-kind-options" role="group" aria-label="常用动态标识">
      {NEWS_KIND_SUGGESTIONS.map((kind) => <button key={kind} type="button" disabled={disabled} aria-pressed={normalizeNewsKind(value) === kind} onClick={() => onChange(kind)}>{kind}</button>)}
      <button type="button" disabled={disabled || !value} onClick={() => onChange('')}>清除标识</button>
    </div>
    <p id={`${id}-help`} className="cms-muted">选择常用标识或输入自定义文字，最多 {MAX_NEWS_KIND_LENGTH} 字；留空时前台不显示。</p>
  </div>
}
