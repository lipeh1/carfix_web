'use client'

// 统计报表：收支汇总、挂账明细和营收主图，保留现有统计口径与数据来源
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/mobile/NavBar'
import Empty from '@/components/mobile/Empty'
import PageSkeleton from '@/components/PageSkeleton'
import { getStats } from '@/lib/api'
import type { StatsData } from '@/lib/types'
import { fenToYuan } from '@/lib/money'
import { useAnimatedYuan } from '@/lib/hooks'
import { formatDate } from '@/lib/format'

// 状态名称仅用于展示，空状态以小字保留，不占独立图表行
const STATUS_LIST = [
  { status: 'pending_inspection', label: '待检测' },
  { status: 'pending_quote', label: '待报价' },
  { status: 'repairing', label: '维修中' },
  { status: 'pending_quality_check', label: '待质检' },
  { status: 'pending_settlement', label: '待结算' },
  { status: 'completed', label: '已完成' },
  { status: 'cancelled', label: '已取消' }
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

  // 柱状图高度（最大营收为 100%）
  const revenues = (stats.months || []).map((m) => m.revenue || 0)
  const maxRevenue = Math.max(...revenues, 1)
  const getBarHeight = (revenue: number) => (revenue / maxRevenue) * 100

  // 工单状态统计
  const dist = stats.statusDistribution || []
  const totalOrders = dist.reduce((sum, s) => sum + (s.count || 0), 0)
  const getStatusCount = (status: string) => dist.find((s) => s.status === status)?.count || 0
  const getStatusPercent = (status: string) => totalOrders === 0 ? 0 : (getStatusCount(status) / totalOrders) * 100

  return (
    <div className="page-container">
      <NavBar title="统计报表" />
      <div className="page-content report-layout">
        <section className="report-overview">
          <div className="section-title">数据概览</div>
          <div className="report-revenue"><span>总营收</span><span className="amount">¥{revenueDisplay}</span></div>
          <div className="report-counts">
            <span>总工单 <b>{stats.overview?.totalOrders || 0}</b></span>
            <span>客户数 <b>{stats.overview?.customerCount || 0}</b></span>
            <span>车辆数 <b>{stats.overview?.vehicleCount || 0}</b></span>
          </div>
        </section>

        {/* 挂账优先呈现车牌和待收金额；桌面与主图并列 */}
        <section className="report-section report-unpaid">
          <div className="flex-between">
            <span className="section-title">挂账明细</span>
            {!!stats.unpaid?.total && <span className="amount">¥{fenToYuan(stats.unpaid.total)}</span>}
          </div>
          {stats.unpaid?.list?.length ? stats.unpaid.list.map(item => (
            <button type="button" key={item.id} className="report-unpaid-row" onClick={() => router.push(`/orders/${item.orderId}`)}>
              <div className="flex-between gap-3"><span className="order-plate">{item.plateNumber}</span><span>{item.customerName || '未知客户'}</span></div>
              <div className="identity-meta"><span className="font-mono">{item.settlementNo}</span><time>{formatDate(item.createdAt)}</time></div>
              <div className="flex-between mt-3"><span className="text-muted">欠</span><span className="amount">¥{fenToYuan(item.unpaidAmount)}</span></div>
            </button>
          )) : <Empty description="暂无挂账" />}
        </section>

        {/* 仅主图使用一次生长反馈，其他统计不逐行播放动画 */}
        <section className="report-section report-trend">
          <div className="section-title">近6个月营收趋势</div>
          {total6Months > 0 ? (
            <div className="report-chart" role="img" aria-label={stats.months.map(m => `${m.month} 营收 ${fenToYuan(m.revenue)} 元`).join('，')}>
              {stats.months.map((m, idx) => (
                <div key={m.month} className="report-month">
                  <div className="report-bar-area">
                    <div className={`chart-bar report-bar${idx === stats.months.length - 1 ? ' is-current' : ''}`} style={{ height: `${getBarHeight(m.revenue)}%` }}>
                      {m.revenue > 0 && <span>¥{fenToYuan(m.revenue)}</span>}
                    </div>
                  </div>
                  <time>{m.month.slice(5)}</time>
                </div>
              ))}
            </div>
          ) : <Empty description="暂无数据" />}
          <div className="report-chart-total"><span>6个月合计：<span className="amount">¥{fenToYuan(total6Months)}</span></span><span>工单 <span className="font-mono">{total6MonthsOrders}</span> 单</span></div>
        </section>

        <section className="report-section">
          <div className="section-title">工单状态分布</div>
          {STATUS_LIST.filter(s => getStatusCount(s.status) > 0).map(s => (
            <div key={s.status} className="report-status-row">
              <span>{s.label}</span><div className="report-status-track"><span style={{ width: `${getStatusPercent(s.status)}%` }} /></div><span>{getStatusCount(s.status)}</span>
            </div>
          ))}
          <div className="report-zero-states">{STATUS_LIST.filter(s => !getStatusCount(s.status)).map(s => <span key={s.status}>{s.label} <span className="font-mono">0</span></span>)}</div>
        </section>

        <section className="report-section">
          <div className="section-title">维修项目热度排行</div>
          {stats.topItems?.length ? stats.topItems.map((item, idx) => (
            <div key={item.name} className="report-ranking">
              <span>{idx + 1}</span><div><div>{item.name}</div><div className="text-muted"><span className="font-mono">{item.count}</span>次 · 累计</div></div><span className="amount">¥{fenToYuan(item.total)}</span>
            </div>
          )) : <Empty description="暂无数据" />}
        </section>
      </div>
    </div>
  )
}
