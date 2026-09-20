'use client'

// 表单行：标签在控件上方，对齐旧 van-field 的表单布局形态
import { Label } from '@/components/ui/label'

interface FieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export default function Field({ label, children, className }: FieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-[13px]" style={{ color: 'var(--ink-subtle)' }}>
        {label}
      </Label>
      {children}
    </div>
  )
}
