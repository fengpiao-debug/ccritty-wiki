export const EVENT_STATUSES = [
  { value: 'pending', label: '待定（待官宣）' },
  { value: 'upcoming', label: '即将到来' },
  { value: 'sold-out', label: '已售罄' },
  { value: 'ended', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
]

export const PENDING_EVENT_NOTICE = '审批已通过，尚未官宣；时间、地点等信息以官方公布为准。'
export const isPendingEvent = (event) => event.status === 'pending'
export const eventStatusLabel = (status) => EVENT_STATUSES.find((item) => item.value === status)?.label || status || ''
