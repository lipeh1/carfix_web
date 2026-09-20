// 空状态占位（对齐旧 van-empty）
import { Inbox } from 'lucide-react'

export default function Empty({ description }: { description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Inbox size={44} strokeWidth={1.2} style={{ color: 'var(--ink-tertiary)' }} />
      <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-subtle)' }}>{description}</p>
    </div>
  )
}
