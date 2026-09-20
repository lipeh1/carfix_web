// 状态徽章：pill 圆角 + 语义色低饱和底 + 同色文字（仅小面积使用，符合 UI 规范）
import { cn } from '@/lib/utils'
import { getOrderStatusTone } from '@/lib/format'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'default'

// 语义色到设计令牌的映射（default 用表面2 + 辅助文字）
const TONE_VARS: Record<Tone, { text: string; bg: string }> = {
  primary: { text: 'var(--primary-hover)', bg: 'var(--primary)' },
  success: { text: 'var(--success)', bg: 'var(--success)' },
  warning: { text: 'var(--warning)', bg: 'var(--warning)' },
  danger: { text: 'var(--danger)', bg: 'var(--danger)' },
  default: { text: 'var(--ink-subtle)', bg: 'var(--ink-subtle)' }
}

export function Badge({ tone = 'default', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const v = TONE_VARS[tone]
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] leading-4', className)}
      style={{
        color: v.text,
        background: tone === 'default' ? 'var(--surface-2)' : `color-mix(in srgb, ${v.bg} 14%, transparent)`
      }}
    >
      {children}
    </span>
  )
}

// 工单状态徽章（按状态取语义色）
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = { pending_inspection: '待检测', pending_quote: '待报价', repairing: '维修中', pending_quality_check: '待质检', pending_settlement: '待结算', completed: '已完成', cancelled: '已取消' }[status] || status
  return <Badge tone={getOrderStatusTone(status)} className={className}>{label}</Badge>
}
