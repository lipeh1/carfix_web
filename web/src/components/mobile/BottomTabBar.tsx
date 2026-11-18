'use client'

// 导航复用同一组入口：手机显示底栏，桌面显示紧凑侧栏
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, Contact, Bell, Wrench } from 'lucide-react'

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
  return (
    <nav className="workspace-nav" aria-label="主导航">
      <div className="workspace-brand"><Wrench size={20} strokeWidth={1.7} /><span>汽修管理系统</span></div>
      {TABS.map(tab => {
        const active = tab.path === activePath
        const Icon = tab.icon
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="workspace-nav-link"
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={1.7} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
