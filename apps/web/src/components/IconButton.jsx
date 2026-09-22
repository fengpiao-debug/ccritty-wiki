// 文件作用：apps/web/src/components/IconButton.jsx，负责可复用的 React UI 组件。
import { forwardRef } from 'react'

// Shared icon button keeps tool actions compact and gives every unfamiliar icon a tooltip.
export const IconButton = forwardRef(function IconButton(
  { label, children, className = '', ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" title={label} aria-label={label} className={`icon-button ${className}`} {...props}>
      {children}
    </button>
  )
})
