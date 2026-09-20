'use client'

// 悬浮毛玻璃导航栏：fixed 定位 + 同高度占位，替代旧 van-nav-bar（fixed placeholder 模式）
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface NavBarProps {
  title: string
  /** 右侧操作区（文字按钮等） */
  right?: React.ReactNode
  /** 显示返回键（tab 页传 false） */
  back?: boolean
}

export default function NavBar({ title, right, back = true }: NavBarProps) {
  const router = useRouter()

  // 内容行 46px + 顶部安全区（PWA 全面屏刘海），占位与实栏同高
  const barHeight = 'calc(46px + env(safe-area-inset-top))'

  return (
    <>
      {/* 占位：把固定导航栏的高度撑出来，内容不被遮挡 */}
      <div style={{ height: barHeight }} />
      <header
        className="material-bar fixed inset-x-0 top-0 z-40 flex items-center border-b border-border"
        style={{ height: barHeight, paddingTop: 'env(safe-area-inset-top)' }}
      >
        {back ? (
          <button
            type="button"
            aria-label="返回"
            className="pressable flex h-[46px] w-11 shrink-0 items-center justify-center"
            style={{ color: 'var(--ink-muted)' }}
            onClick={() => router.back()}
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="h-[46px] w-11 shrink-0" />
        )}
        <h1
          className="min-w-0 flex-1 truncate px-2 text-center text-[16px] font-medium"
          style={{ color: 'var(--ink)', letterSpacing: '-0.2px' }}
        >
          {title}
        </h1>
        {/* 右侧操作区固定最小宽度与左侧对称，保证标题真正居中 */}
        <div className="flex h-[46px] min-w-11 shrink-0 items-center justify-end pr-3 text-[14px]">
          {right}
        </div>
      </header>
    </>
  )
}
