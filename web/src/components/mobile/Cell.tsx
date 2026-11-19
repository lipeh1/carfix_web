'use client'

// 列表行组件：标题/说明/右侧附加/箭头，行间发丝线分割（对齐旧 van-cell 的使用形态）
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CellProps {
  title: React.ReactNode
  label?: React.ReactNode
  /** 右侧附加内容（徽章/文字），与箭头并存 */
  right?: React.ReactNode
  /** 点击态：显示箭头 + 按压反馈 */
  onClick?: () => void
  className?: string
}

export default function Cell({ title, label, right, onClick, className }: CellProps) {
  const Row = onClick ? 'button' : 'div'
  return (
    <Row
      type={onClick ? 'button' : undefined}
      className={cn(
        'data-cell flex w-full items-center border-b py-[13px] text-left',
        onClick && 'pressable cursor-pointer',
        className
      )}
      style={{ borderColor: 'var(--hairline)' }}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">
        <span className="cell-title block" style={{ color: 'var(--ink)' }}>{title}</span>
        {label != null && label !== '' && (
          <span className="cell-description block">{label}</span>
        )}
      </span>
      {right != null && <span className="cell-value shrink-0" style={{ color: 'var(--ink-subtle)' }}>{right}</span>}
      {onClick && <ChevronRight aria-hidden="true" size={16} className="shrink-0" style={{ color: 'var(--ink-tertiary)' }} />}
    </Row>
  )
}
