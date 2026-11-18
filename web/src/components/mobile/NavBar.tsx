'use client'

// 实色工作栏：固定定位与等高占位，手机和桌面保持一致的内容对齐线
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

  return (
    <>
      {/* 占位：把固定导航栏的高度撑出来，内容不被遮挡 */}
      <div className="app-nav-spacer" />
      <header className="app-nav">
        <div className="app-nav-inner">
          {back ? (
            <button
              type="button"
              aria-label="返回"
              className="pressable nav-back"
              onClick={() => router.back()}
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <h1 className="truncate">
            {title}
          </h1>
          <div className="app-nav-actions">
            {right}
          </div>
        </div>
      </header>
    </>
  )
}
