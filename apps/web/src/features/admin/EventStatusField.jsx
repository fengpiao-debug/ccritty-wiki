import { useId, useState } from 'react'
import { EVENT_STATUSES } from '@artist-wiki/content-types'

export function EventStatusField({ value, disabled, onChange }) {
  const id = useId()
  const known = !value || EVENT_STATUSES.some((item) => item.value === value)
  const [customSelected, setCustomSelected] = useState(!known)
  const custom = customSelected || !known
  function selectStatus(event) {
    const next = event.target.value
    const isCustom = next === '__custom__'
    setCustomSelected(isCustom)
    onChange(isCustom ? (known ? '' : value) : next)
  }
  return <div className="full cms-event-status-field">
    <label htmlFor={id}>活动状态
      <select id={id} value={custom ? '__custom__' : value || ''} disabled={disabled} aria-describedby={`${id}-help`} onChange={selectStatus}>
        <option value="">未标注</option>
        {EVENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        <option value="__custom__">自定义…</option>
      </select>
    </label>
    {custom && <label htmlFor={`${id}-custom`}>自定义状态
      <input id={`${id}-custom`} value={value || ''} disabled={disabled} placeholder="例如：预售中、延期、报名中" aria-describedby={`${id}-custom-help`} onChange={(event) => onChange(event.target.value)} />
    </label>}
    <p id={`${id}-custom-help`} className="cms-muted">选择预设状态或“自定义…”填写文字；保存后显示在前台活动卡片上，留空不显示。</p>
    <p id={`${id}-help`} className="cms-muted">审批通过但尚未官宣时，选择“待定（待官宣）”，活动会置顶，开始时间可留空；官宣后改为其他状态，恢复按时间排序。</p>
  </div>
}
