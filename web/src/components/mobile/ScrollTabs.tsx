'use client'

// 可横向滚动的状态筛选栏：实色底与单条激活指示线

interface ScrollTabsProps {
  tabs: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
}

export default function ScrollTabs({ tabs, value, onChange }: ScrollTabsProps) {
  return (
    <div className="scroll-tabs">
      {tabs.map(t => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            className="scroll-tab"
            aria-pressed={active}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
