'use client'

// 全屏图片预览：黑底 lightbox + 左右滑动切换，替代旧 van-image-preview
// cover 插槽用于底部操作条（报价图「保存图片」等）
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImagePreviewProps {
  images: string[]
  /** 初始展示的图片下标 */
  index?: number
  onClose: () => void
  /** 底部覆盖操作条 */
  cover?: React.ReactNode
}

export default function ImagePreview({ images, index = 0, onClose, cover }: ImagePreviewProps) {
  const [current, setCurrent] = useState(index)
  // 滑动跟手的实时偏移
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)
  const dragging = useRef(false)
  const multiple = images.length > 1

  // 打开期间锁住背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const go = (dir: 1 | -1) => {
    const next = current + dir
    if (next >= 0 && next < images.length) setCurrent(next)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    setDragX(e.touches[0].clientX - startX.current)
  }
  const onTouchEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    // 滑动超过 60px 切换图片，否则弹回
    if (dragX < -60) go(1)
    else if (dragX > 60) go(-1)
    setDragX(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* 顶栏：序号 + 关闭 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <span className="text-[13px] tabular-nums" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {multiple ? `${current + 1}/${images.length}` : ''}
        </span>
        <button
          type="button"
          aria-label="关闭"
          className="pressable flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onClick={onClose}
        >
          <X size={20} style={{ color: '#fff' }} />
        </button>
      </div>

      {/* 图片区：滑动切换 */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-2"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* 全屏 lightbox 按手势拖动渲染，dataURL/Blob URL 不走 next/image 优化（豁免 no-img-element） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current}
          src={images[current]}
          alt=""
          draggable={false}
          className={cn('max-h-full max-w-full select-none object-contain')}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)'
          }}
        />
      </div>

      {/* 底部操作条（报价图保存等） */}
      {cover && (
        <div
          className="flex items-center justify-center px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          {cover}
        </div>
      )}
    </div>
  )
}
