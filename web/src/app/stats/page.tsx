'use client'

// 统计报表：收支汇总、挂账明细和营收主图，保留现有统计口径与数据来源
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Empty from '@/components/mobile/Empty'
import PageSkeleton from '@/components/PageSkeleton'
import { Button } from '@/components/ui/button'
import { getStats } from '@/lib/api'
import type { StatsData } from '@/lib/types'
import { fenToYuan } from '@/lib/money'
import { useAnimatedYuan } from '@/lib/hooks'
import { formatDate, getOrderStatusLabel } from '@/lib/format'

// 状态名称仅用于展示，空状态以小字保留，不占独立图表行
const STATUS_LIST = [
  'pending_inspection', 'pending_quote', 'repairing', 'pending_quality_check', 'pending_settlement', 'completed', 'cancelled'
]

export default function StatsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  // 总营收数字滚动展示（分值驱动）
  const revenueDisplay = useAnimatedYuan(stats?.overview?.totalRevenue || 0, 1)

  const loadData = useCallback(async () => {
    setLoadFailed(false)
    try {
      setStats(await getStats())
    } catch {
      // 展示失败态并允许点击重试
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  if (!stats) {
    return (
      <div className="page-container">
        <NavBar title="统计报表" />
        {!loadFailed ? <PageSkeleton cards={4} /> : (
          <button type="button" className="w-full" onClick={loadData}>
            <Empty description="加载失败，点击重试" />
          </button>
        )}
      </div>
    )
  }

  // 近6个月汇总
  const total6Months = (stats.months || []).reduce((sum, m) => sum + (m.revenue || 0), 0)
  const total6MonthsOrders = (stats.months || []).reduce((sum, m) => sum + (m.orderCount || 0), 0)

  // 月份和金额各占一列，条形长度以最高月营收为基准。
  const revenues = (stats.months || []).map((m) => m.revenue || 0)
  const maxRevenue = Math.max(...revenues, 1)

  // 工单状态统计
  const dist = stats.statusDistribution || []
  const totalOrders = dist.reduce((sum, s) => sum + (s.count || 0), 0)
  const getStatusCount = (status: string) => dist.find((s) => s.status === status)?.count || 0
  const getStatusPercent = (status: string) => totalOrders === 0 ? 0 : (getStatusCount(status) / totalOrders) * 100
  const statuses = [...new Set([...STATUS_LIST, ...dist.map(entry => entry.status)])]
  const hasActivity = Boolean(stats.overview?.totalOrders || stats.overview?.totalRevenue || totalOrders
    || total6MonthsOrders || total6Months || stats.unpaid?.total || stats.unpaid?.list?.length || stats.topItems?.length)

  return (
    <div className="page-container">
      <NavBar title="统计报表" />
      <div className="page-content report-layout">
        <section className="report-overview">
          <div className="section-title">数据概览</div>
          <div className={`report-revenue${stats.overview?.totalRevenue ? '' : ' is-zero'}`}><span>总营收</span><span className="amount">¥{revenueDisplay}</span></div>
          <div className="report-counts">
            <span>总工单 <b>{stats.overview?.totalOrders || 0}</b></span>
            <span>客户数 <b>{stats.overview?.customerCount || 0}</b></span>
            <span>车辆数 <b>{stats.overview?.vehicleCount || 0}</b></span>
          </div>
        </section>

        {hasActivity ? <>
        {/* 挂账优先呈现车牌和待收金额；桌面与主图并列 */}
        <section className={`report-section report-unpaid${stats.unpaid?.list?.length ? '' : ' report-quiet'}`}>
          <div className="flex-between">
            <span className="section-title">挂账明细</span>
            {!!stats.unpaid?.total && <span className="amount">¥{fenToYuan(stats.unpaid.total)}</span>}
          </div>
          {stats.unpaid?.list?.length ? stats.unpaid.list.map(item => (
            <button type="button" key={item.id} className="report-unpaid-row" onClick={() => router.push(`/orders/${item.orderId}`)}>
              <span className="unpaid-line"><span className="order-plate">{item.plateNumber || item.settlementNo}</span><span className="amount"><small>欠</small> ¥{fenToYuan(item.unpaidAmount)}</span></span>
              <span className="identity-meta">{item.customerName && <span>{item.customerName}</span>}<time>{formatDate(item.createdAt)}</time>{item.plateNumber && <span className="font-mono">{item.settlementNo}</span>}</span>
            </button>
          )) : <span className="text-muted">暂无挂账</span>}
        </section>

        {/* 仅主图使用一次生长反馈，其他统计不逐行播放动画 */}
        <section className="report-section report-trend">
          <div className="section-title">近6个月营收趋势</div>
          {total6Months > 0 ? (
            <ol className="report-chart" aria-label="各月营收">
              {stats.months.map((m, idx) => (
                <li key={m.month} className="report-month">
                  <time dateTime={m.month}>{m.month}</time>
                  <span className="report-bar-area" aria-hidden="true"><span className={`report-bar${idx === stats.months.length - 1 ? ' is-current' : ''}`} style={{ width: `${m.revenue / maxRevenue * 100}%` }} /></span>
                  <span>¥{fenToYuan(m.revenue)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="report-chart-total"><span>6个月合计：<span className="amount">¥{fenToYuan(total6Months)}</span></span><span>工单 <span className="font-mono">{total6MonthsOrders}</span> 单</span></div>
        </section>

        <section className="report-section">
          <div className="section-title">工单状态分布</div>
          {statuses.filter(s => getStatusCount(s) > 0).map(s => (
            <div key={s} className="report-status-row">
              <span>{getOrderStatusLabel(s)}</span><div className="report-status-track"><span style={{ width: `${getStatusPercent(s)}%` }} /></div><span>{getStatusCount(s)}</span>
            </div>
          ))}
          <div className="report-zero-states">{statuses.filter(s => !getStatusCount(s)).map(s => <span key={s}>{getOrderStatusLabel(s)} <span className="font-mono">0</span></span>)}</div>
        </section>

        <section className={`report-section${stats.topItems?.length ? '' : ' report-quiet'}`}>
          <div className="section-title">维修项目热度排行</div>
          {stats.topItems?.length ? stats.topItems.map((item, idx) => (
            <div key={item.name} className="report-ranking">
              <span>{idx + 1}</span><div><div>{item.name}</div><div className="text-muted"><span className="font-mono">{item.count}</span>次 · 累计</div></div><span className="amount">¥{fenToYuan(item.total)}</span>
            </div>
          )) : <span className="text-muted">暂无项目记录</span>}
        </section>
        </> : <Empty page description="还没有工单，接车后可在这里查看统计">
          <Button asChild className="list-create"><Link href="/checkin"><Plus size={16} />新建接车</Link></Button>
        </Empty>}
      </div>
    </div>
  )
}
