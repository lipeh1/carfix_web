'use client'

// 下拉刷新：touch 手势实现，替代旧 van-pull-refresh
// 用法：组件自身即滚动容器，挂在 page-frame 内替代 scroll-area
//   <PullToRefresh onRefresh={load} className="scroll-area">...</PullToRefresh>
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const TRIGGER_DISTANCE = 60 // 松手触发刷新的下拉距离
const MAX_DISTANCE = 90 // 指示器最大跟随距离（阻尼后）

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>
  children: React.ReactNode
  className?: string
}

export default function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0) // 当前下拉距离（阻尼后）
  const [loading, setLoading] = useState(false)
  // 手势状态存 ref，避免频繁 setState 引起抖动
  const pulling = useRef(false)
  const startY = useRef(0)

  const doRefresh = useCallback(async () => {
    setLoading(true)
    try {
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }, [onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      // 仅当内容已滚到顶时才开始下拉手势
      if (el.scrollTop <= 0 && !loading) {
        pulling.current = true
        startY.current = e.touches[0].clientY
      }
    }

    // 需要非 passive 监听才能 preventDefault 阻止原生橡皮筋
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || loading) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) {
        setDistance(0)
        return
      }
      // 已滚出顶部继续下拉时阻止页面整体的浏览器默认滚动
      if (el.scrollTop <= 0) e.preventDefault()
      // 阻尼：越拉越重
      const damped = Math.min(MAX_DISTANCE, delta * 0.55)
      setDistance(damped)
    }

    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      // 达到触发距离则进入刷新态（指示器收起为刷新中高度）
      if (distance >= TRIGGER_DISTANCE) {
        setDistance(0)
        void doRefresh()
      } else {
        setDistance(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [distance, loading, doRefresh])

  const indicatorTop = loading ? 40 : -Math.max(0, 44 - distance)
  const progress = Math.min(1, distance / TRIGGER_DISTANCE)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 刷新指示器：固定悬在内容区顶端 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ transform: `translateY(${indicatorTop}px)`, transition: pulling.current ? 'none' : 'transform 0.25s ease' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--hairline)' }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--primary-hover)' }} />
          ) : (
            <ArrowDown
              size={18}
              style={{ color: 'var(--ink-subtle)', transform: `rotate(${progress * 180}deg)`, transition: 'transform 0.1s' }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: pulling.current ? 'none' : 'transform 0.25s ease'
        }}
      >
        {children}
      </div>
    </div>
  )
}
