// 动态、活动共用的多标签编辑器；待输入文字由表单保存逻辑一并提交。
import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { normalizeTags, validateTags } from '@artist-wiki/content-types'

export function TimelineTagEditor({ label, tags, pending = '', disabled, onChange }) {
  const id = useId()
  const values = normalizeTags(tags)
  const next = normalizeTags([...values, pending])
  const invalid = validateTags(next)
  function add() {
    if (!pending.trim() || invalid || disabled) return
    onChange({ tags: next, pendingTag: '' })
  }
  return <div className="full cms-tag-editor">
    <label htmlFor={id}>{label}（可添加多个）</label>
    {values.length > 0 && <ul className="cms-tag-list" aria-label={`已添加的${label}`}>{values.map((tag) =>
      <li key={tag}><span>{tag}</span><button type="button" disabled={disabled} aria-label={`删除标签：${tag}`} onClick={() => onChange({ tags: values.filter((value) => value !== tag) })}><X size={13} aria-hidden="true" /></button></li>,
    )}</ul>}
    <div className="cms-tag-input-row">
      <input id={id} disabled={disabled} value={pending} placeholder="例如：拼盘演出，国风，南京" aria-describedby={`${id}-help`} aria-invalid={invalid ? true : undefined} onChange={(event) => onChange({ pendingTag: event.target.value })} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); add() }
      }} />
      <button type="button" className="cms-button" disabled={disabled || !pending.trim() || !!invalid} onClick={add}><Plus size={15} aria-hidden="true" />添加标签</button>
    </div>
    <p id={`${id}-help`} className="cms-muted">输入后按回车或点击“添加标签”；多个标签可用逗号分隔，点击 × 删除。最多 20 个，每个最多 40 字。</p>
    {invalid && <p className="cms-alert error" role="alert">{invalid}</p>}
  </div>
}
