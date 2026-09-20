'use client'

// 可横向滚动的文字 tabs：玻璃材质底（内容从下方滚过时透出），激活项主色 + 底部指示条
// 对齐旧 van-tabs 在列表页的形态
import { cn } from '@/lib/utils'

interface ScrollTabsProps {
  tabs: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
}

export default function ScrollTabs({ tabs, value, onChange }: ScrollTabsProps) {
  return (
    <div
      className="flex overflow-x-auto border-b"
      style={{
        borderColor: 'var(--hairline)',
        background: 'var(--canvas-translucent)',
        WebkitBackdropFilter: 'var(--material-blur)',
        backdropFilter: 'var(--material-blur)'
      }}
    >
      {tabs.map(t => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            className={cn('shrink-0 px-4 pb-2 pt-2.5 text-[14px] transition-colors')}
            style={{
              color: active ? 'var(--primary-hover)' : 'var(--ink-subtle)',
              fontWeight: active ? 500 : 400,
              borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`
            }}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
