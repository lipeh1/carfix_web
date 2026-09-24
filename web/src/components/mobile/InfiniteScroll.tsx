'use client'

// 无限滚动加载：IntersectionObserver 哨兵，替代旧 van-list
// onLoadMore 返回的 Promise 结束后自动继续观察，hasMore 为 false 时展示「没有更多了」
import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface InfiniteScrollProps {
  hasMore: boolean
  onLoadMore: () => Promise<unknown>
  /** 空列表时不渲染底部提示（空态由页面自己画） */
  isEmpty?: boolean
}

export default function InfiniteScroll({ hasMore, onLoadMore, isEmpty }: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  // 用 ref 保存最新的加载函数，避免 observer 反复重建（在 effect 中同步，不在渲染期写 ref）
  const loadRef = useRef(onLoadMore)
  const busyRef = useRef(false)

  useEffect(() => {
    loadRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || busyRef.current) return
        busyRef.current = true
        try {
          await loadRef.current()
        } finally {
          busyRef.current = false
        }
      },
      // 提前 200px 触发，滚动更顺滑
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

  if (isEmpty) return null

  return (
    <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>
      {hasMore ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          加载中...
        </>
      ) : (
        '没有更多了'
      )}
    </div>
  )
}
