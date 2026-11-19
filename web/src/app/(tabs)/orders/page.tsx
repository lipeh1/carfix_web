'use client'

// 工单列表：搜索 + 8 状态 tabs + 下拉刷新 + 无限滚动 + 骨架屏（自旧 Orders.vue 移植）
import { Suspense, useCallback, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Plus, Search } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Empty from '@/components/mobile/Empty'
import ScrollTabs from '@/components/mobile/ScrollTabs'
import { StatusBadge } from '@/components/mobile/Badge'
import PullToRefresh from '@/components/mobile/PullToRefresh'
import InfiniteScroll from '@/components/mobile/InfiniteScroll'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getOrders } from '@/lib/api'
import { useListView } from '@/lib/useListView'
import { fenToYuan } from '@/lib/money'
import { formatDateTime } from '@/lib/format'

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
  // 支持 /orders?status=xxx 直达指定状态（首页概览数字跳转入口）
  const queryStatus = useSearchParams().get('status') ?? ''

  const [activeTab, setActiveTab] = useState(TABS.some(t => t.value === queryStatus) ? queryStatus : '')
  const [keyword, setKeyword] = useState('')
  const read = useCallback(() => getOrders({ status: activeTab, keyword }), [activeTab, keyword])
  const { rows: orders, phase, refresh: loadOrders } = useListView(read)
  const showSkeleton = phase === 'loading' && !orders.length
  const filtered = Boolean(activeTab || keyword)
  const empty = phase === 'ready' && orders.length === 0
  const checkin = <Button asChild className="list-create"><Link href="/checkin"><Plus size={16} />新建接车</Link></Button>

  return (
    <div className="page-container page-frame">
      <NavBar title="工单" back={false} right={(!empty || filtered) && checkin} />

      {/* 搜索框 */}
      <div className="orders-toolbar">
        <div className="orders-search">
          <Search size={17} strokeWidth={1.7} />
          <Input
            value={keyword}
            placeholder="搜索工单号/车牌号/客户名/诉求"
            aria-label="搜索工单号/车牌号/客户名/诉求"
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadOrders() }}
          />
        </div>
        <button
          type="button"
          className="pressable orders-search-action"
          onClick={loadOrders}
        >
          搜索
        </button>
      </div>

      <ScrollTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      <PullToRefresh className="scroll-area" onRefresh={loadOrders}>
        <div className="page-content orders-list">
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

          {/* 列表直接呈现，手机分行、桌面对齐固定列，不为每行播放进场 */}
          {orders.map(order => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="order-row"
            >
              <span className="order-row-identity">
                <span className="order-plate">{order.vehicle?.plateNumber || order.orderNo}</span>
                <StatusBadge status={order.status} />
              </span>
              <span className="order-row-customer">{order.customer?.name || '未知客户'}</span>
              <span className="order-row-complaint">{order.complaint || '无诉求'}</span>
              <span className="order-row-amount">
                {!!order.finalAmount && <span>¥{fenToYuan(order.finalAmount)}</span>}
                <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="order-row-meta">
                {(order.vehicle?.brand || order.vehicle?.model) && <span>{order.vehicle.brand} {order.vehicle.model}</span>}
                <time>进厂 {formatDateTime(order.createdAt)}</time>
                {order.vehicle?.plateNumber && <span className="font-mono">{order.orderNo}</span>}
              </span>
            </Link>
          ))}

          {empty && (filtered ? (
            <Empty page description={keyword ? '没有匹配的工单' : '当前状态下没有工单'}>
              <button className="inline-action" onClick={() => { setKeyword(''); setActiveTab('') }}>查看全部工单</button>
            </Empty>
          ) : (
            <Empty page description="还没有工单，来车时从这里登记">{checkin}</Empty>
          ))}
          {phase === 'error' && !orders.length && (
            <Empty page description="工单加载失败"><button className="inline-action" onClick={loadOrders}>重试</button></Empty>
          )}
          <InfiniteScroll
            hasMore={showSkeleton}
            onLoadMore={loadOrders}
            isEmpty={!orders.length}
            finishedLabel={orders.length > 1 ? `共 ${orders.length} 张工单` : ''}
          />
        </div>
      </PullToRefresh>

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
