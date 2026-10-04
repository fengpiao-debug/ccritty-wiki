import { useId } from 'react'
import { EVENT_STATUSES } from '@artist-wiki/content-types'

export function EventStatusField({ value, disabled, onChange }) {
  const id = useId()
  const known = !value || EVENT_STATUSES.some((item) => item.value === value)
  return <div className="full">
    <label htmlFor={id}>活动状态
      <select id={id} value={value || ''} disabled={disabled} aria-describedby={`${id}-help`} onChange={(event) => onChange(event.target.value)}>
        <option value="">未标注</option>
        {EVENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        {!known && <option value={value}>{value}</option>}
      </select>
    </label>
    <p id={`${id}-help`} className="cms-muted">审批通过但尚未官宣时，选择“待定（待官宣）”，活动会置顶，开始时间可留空；官宣后改为其他状态，恢复按时间排序。</p>
  </div>
}
