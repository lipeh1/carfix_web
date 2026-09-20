'use client'

// 底部标签栏：半透明材质 + 安全区适配，替代旧 Vant TabBarLayout
// 平级 tab 间切换动画由 (tabs) 分组的 template.tsx 负责
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, Contact, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { path: '/', label: '工作台', icon: Home },
  { path: '/orders', label: '工单', icon: ClipboardList },
  { path: '/customers', label: '客户', icon: Contact },
  { path: '/reminders', label: '提醒', icon: Bell }
] as const

export default function BottomTabBar() {
  const pathname = usePathname()
  // 精确匹配当前激活 tab（避免 / 匹配所有路径）
  const activePath = TABS.find(t => t.path === pathname)?.path ?? null
  // 记录上一次激活路径，激活图标弹跳动画只在切换发生时重放
  const [popPath, setPopPath] = useState<string | null>(null)
  const prevRef = useRef<string | null>(null)

  useEffect(() => {
    if (activePath && activePath !== prevRef.current) setPopPath(activePath)
    prevRef.current = activePath
  }, [activePath])

  return (
    <nav
      className="material-bar fixed inset-x-0 bottom-0 z-40 flex border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(tab => {
        const active = tab.path === activePath
        const Icon = tab.icon
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 select-none"
            style={{ color: active ? '#828fff' : 'var(--ink-subtle)' }}
          >
            {/* 激活瞬间图标轻微弹跳（微过冲曲线） */}
            <Icon size={22} strokeWidth={1.8} className={cn(active && popPath === tab.path && 'tab-icon-pop')} />
            <span className="text-[11px]" style={{ fontWeight: active ? 500 : 400 }}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
