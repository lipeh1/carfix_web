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
  const clickable = !!onClick
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b py-[13px]',
        clickable && 'pressable cursor-pointer',
        className
      )}
      style={{ borderColor: 'var(--hairline)' }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug" style={{ color: 'var(--ink)' }}>{title}</div>
        {label != null && label !== '' && (
          <div className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--ink-subtle)' }}>{label}</div>
        )}
      </div>
      {right != null && <div className="shrink-0 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>{right}</div>}
      {clickable && <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--ink-tertiary)' }} />}
    </div>
  )
}
