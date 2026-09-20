'use client'

// 底部弹窗：更实材质（--sheet-translucent 0.86 透明度）+ 毛玻璃 + 顶部大圆角
// 替代旧 van-popup position="bottom"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  className?: string
  /** 顶部把手条（默认显示） */
  handle?: boolean
}

export default function BottomSheet({ open, onOpenChange, title, children, className, handle = true }: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn('sheet-material rounded-t-[16px] max-h-[85vh] overflow-y-auto gap-0', className)}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onOpenAutoFocus={e => e.preventDefault()} // 打开不抢焦点，避免页面滚动跳动
      >
        {handle && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-9 rounded-full" style={{ background: 'var(--hairline-strong)' }} />
          </div>
        )}
        {title ? (
          <SheetHeader className="pb-2">
            <SheetTitle className="text-[16px]">{title}</SheetTitle>
            <SheetDescription className="sr-only">{title}</SheetDescription>
          </SheetHeader>
        ) : (
          // 无标题时仍需可访问名，避免读屏器读到空弹窗
          <SheetTitle className="sr-only">弹窗</SheetTitle>
        )}
        <div className="px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
