// 动态与活动共用标签格式；兼容旧记录和逗号分隔的编辑输入。
export function normalizeTags(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return [...new Set(values.filter((tag) => typeof tag === 'string')
    .flatMap((tag) => tag.split(/[,，、;；\n\r]+/u)).map((tag) => tag.trim()).filter(Boolean))]
}

export function validateTags(value) {
  if (value == null) return ''
  if (typeof value !== 'string' && (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string'))) return '标签格式不正确'
  const tags = normalizeTags(value)
  if (tags.length > 20) return '最多添加 20 个标签'
  if (tags.some((tag) => tag.length > 40)) return '每个标签最多 40 个字符'
  return ''
}
