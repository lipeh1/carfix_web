'use client'

// 工单列表：搜索 + 8 状态 tabs + 下拉刷新 + 无限滚动 + 骨架屏（自旧 Orders.vue 移植）
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Search } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import ScrollTabs from '@/components/mobile/ScrollTabs'
import { StatusBadge } from '@/components/mobile/Badge'
import PullToRefresh from '@/components/mobile/PullToRefresh'
import InfiniteScroll from '@/components/mobile/InfiniteScroll'
import { Input } from '@/components/ui/input'
import { getOrders } from '@/lib/api'
import { fenToYuan } from '@/lib/money'

const TABS = [
  { label: '全部', value: '' },
  { label: '待检测', value: 'pending_inspection' },
  { label: '待报价', value: 'pending_quote' },
  { label: '维修中', value: 'repairing' },
  { label: '待质检', value: 'pending_quality_check' },
  { label: '待结算', value: 'pending_settlement' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

function OrdersPageInner() {
  const router = useRouter()
  // 支持 /orders?status=xxx 直达指定状态（首页概览数字跳转入口）
  const queryStatus = useSearchParams().get('status') ?? ''

  const [activeTab, setActiveTab] = useState(TABS.some(t => t.value === queryStatus) ? queryStatus : '')
  const [keyword, setKeyword] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [finished, setFinished] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (activeTab) params.status = activeTab
      if (keyword) params.keyword = keyword
      const data = await getOrders(params)
      setOrders(data as any[])
      setFinished(true)
    } catch { /* 静默 */ } finally {
      setLoading(false)
    }
  }, [activeTab, keyword])

  // 初次与 tab/搜索条件变化后加载（清空列表驱动骨架与进场动画重放）
  useEffect(() => {
    setOrders([])
    setFinished(false)
    void loadOrders()
  }, [loadOrders])

  // 骨架屏展示条件：正在加载且当前无内容（首次进入或切 tab/搜索清空后）
  const showSkeleton = loading && orders.length === 0

  return (
    <div className="page-container page-frame">
      <NavBar title="工单" back={false} />

      {/* 搜索框 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-tertiary)' }} />
          <Input
            value={keyword}
            placeholder="搜索工单号/车牌号/客户名/诉求"
            className="h-9 rounded-lg pl-8"
            style={{ background: 'var(--surface-2)' }}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setOrders([]); setFinished(false); void loadOrders() } }}
          />
        </div>
        <button
          type="button"
          className="pressable shrink-0 text-[14px]"
          style={{ color: 'var(--primary-hover)' }}
          onClick={() => { setOrders([]); setFinished(false); void loadOrders() }}
        >
          搜索
        </button>
      </div>

      <ScrollTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      <PullToRefresh className="scroll-area" onRefresh={loadOrders}>
        <div className="page-content">
          {/* 首次加载/切 tab 骨架：与工单行信息结构对应 */}
          {showSkeleton &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="border-b py-[13px]" style={{ borderColor: 'var(--hairline)' }}>
                <div className="flex-between">
                  <div className="sk sk-line" style={{ width: '38%' }} />
                  <div className="sk sk-pill" />
                </div>
                <div className="sk sk-sm" style={{ width: '62%', marginTop: 10 }} />
                <div className="sk sk-sm" style={{ width: '30%', marginTop: 6 }} />
              </div>
            ))}

          {/* 列表项进场：弹簧上移淡入，逐项错开形成级联；换批时旧项平滑退场 */}
          <AnimatePresence initial={false}>
            {orders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', bounce: 0, duration: 0.35, delay: Math.min(idx * 0.03, 0.24) }}
              >
                <Cell
                  onClick={() => router.push(`/orders/${order.id}`)}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-semibold">{order.vehicle?.plateNumber || '未知车辆'}</span>
                      <StatusBadge status={order.status} />
                    </span>
                  }
                  label={
                    <div className="mt-1">
                      <div className="flex flex-col gap-0.5">
                        <span>{order.customer?.name || '未知客户'}</span>
                        <span className="text-muted">{order.complaint || '无诉求'}</span>
                      </div>
                      {!!order.finalAmount && (
                        <div className="mt-1 font-mono text-[14px] font-semibold" style={{ color: 'var(--danger)' }}>
                          ¥{fenToYuan(order.finalAmount)}
                        </div>
                      )}
                    </div>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {!showSkeleton && orders.length === 0 && !loading && <Empty description="暂无工单" />}
          <InfiniteScroll hasMore={!finished} onLoadMore={loadOrders} isEmpty={orders.length === 0 && !loading} />
        </div>
      </PullToRefresh>

      {/* 右下角新建接车浮动按钮：按压弹簧缩放（避开 tabbar + 安全区） */}
      <motion.button
        type="button"
        aria-label="新建接车"
        className="fixed z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{
          right: 20,
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          background: 'var(--primary)',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
        }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        onClick={() => router.push('/checkin')}
      >
        <Plus size={24} />
      </motion.button>
    </div>
  )
}

// useSearchParams 需要 Suspense 边界（静态导出要求）
export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageInner />
    </Suspense>
  )
}
