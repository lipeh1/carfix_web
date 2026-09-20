'use client'

// 统计报表：概览宫格 / 近6月营收柱状图（scaleY 生长）/ 状态分布 / 项目排行 / 挂账明细（自旧 Stats.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/mobile/NavBar'
import Empty from '@/components/mobile/Empty'
import { Badge } from '@/components/mobile/Badge'
import PageSkeleton from '@/components/PageSkeleton'
import { getStats } from '@/lib/api'
import { fenToYuan } from '@/lib/money'
import { useAnimatedYuan } from '@/lib/hooks'
import { formatDate } from '@/lib/format'

// 状态定义（用于展示）：低饱和徽章色，小面积使用（规范允许）
const STATUS_LIST: Array<{ status: string; label: string; tone: 'default' | 'primary' | 'success' | 'warning' | 'danger'; color: string }> = [
  { status: 'pending_inspection', label: '待检测', tone: 'warning', color: '#ffa059' },
  { status: 'pending_quote', label: '待报价', tone: 'primary', color: '#7a85d9' },
  { status: 'repairing', label: '维修中', tone: 'danger', color: '#f2566a' },
  { status: 'pending_quality_check', label: '待质检', tone: 'warning', color: '#e6c14c' },
  { status: 'pending_settlement', label: '待结算', tone: 'primary', color: '#7a85d9' },
  { status: 'completed', label: '已完成', tone: 'success', color: '#34b757' },
  { status: 'cancelled', label: '已取消', tone: 'default', color: '#4a4e57' }
]

export default function StatsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
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
  const total6Months = (stats.months || []).reduce((sum: number, m: any) => sum + (m.revenue || 0), 0)
  const total6MonthsOrders = (stats.months || []).reduce((sum: number, m: any) => sum + (m.orderCount || 0), 0)

  // 柱状图高度（最大营收为 100%）
  const revenues = (stats.months || []).map((m: any) => m.revenue || 0)
  const maxRevenue = Math.max(...revenues, 1)
  const getBarHeight = (revenue: number) => (revenue / maxRevenue) * 100

  // 工单状态统计
  const dist = stats.statusDistribution || []
  const totalOrders = dist.reduce((sum: number, s: any) => sum + (s.count || 0), 0)
  const getStatusCount = (status: string) => dist.find((s: any) => s.status === status)?.count || 0
  const getStatusPercent = (status: string) => totalOrders === 0 ? 0 : (getStatusCount(status) / totalOrders) * 100

  return (
    <div className="page-container">
      <NavBar title="统计报表" />

      <div className="page-content">
        {/* 基础数据概览 */}
        <div className="card">
          <div className="section-title">数据概览</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: stats.overview?.customerCount || 0, label: '客户数', danger: false },
              { value: stats.overview?.vehicleCount || 0, label: '车辆数', danger: false },
              { value: stats.overview?.totalOrders || 0, label: '总工单', danger: false },
              { value: `¥${revenueDisplay}`, label: '总营收', danger: true }
            ].map(o => (
              <div key={o.label} className="rounded-xl border py-3 text-center" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
                <div className="text-[20px] font-bold" style={{ letterSpacing: '-0.02em', color: o.danger ? 'var(--danger)' : 'var(--ink)' }}>
                  {o.value}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>{o.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 月度营收趋势：高度定布局、scaleY 做生长动画（只动合成器属性），交错延迟依次长出 */}
        <div className="card">
          <div className="section-title">近6个月营收趋势</div>
          <div className="py-2.5">
            <div className="flex h-40 items-end justify-around px-2">
              {stats.months.map((m: any, idx: number) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end">
                  {/* 柱体：单一主色实心柱（规范禁止渐变装饰） */}
                  <div
                    className="chart-bar relative flex min-h-[2px] w-7 justify-center rounded-t"
                    style={{ background: 'var(--primary)', height: `${getBarHeight(m.revenue)}%`, animationDelay: `${idx * 0.05}s` }}
                  >
                    {m.revenue > 0 && (
                      <span className="absolute -top-[18px] whitespace-nowrap font-mono text-[10px]" style={{ color: 'var(--ink-subtle)' }}>
                        ¥{fenToYuan(m.revenue)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-subtle)' }}>{m.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-between mt-3 border-t pt-2 text-[13px]" style={{ borderColor: 'var(--hairline)' }}>
            <span>
              6个月合计：<span className="amount text-[15px]">¥{fenToYuan(total6Months)}</span>
            </span>
            <span className="text-muted">工单 {total6MonthsOrders} 单</span>
          </div>
        </div>

        {/* 工单状态分布：宽度定布局、scaleX 做生长动画（从左展开） */}
        <div className="card">
          <div className="section-title">工单状态分布</div>
          <div className="flex flex-col gap-2.5">
            {STATUS_LIST.map((s, idx) => (
              <div key={s.status} className="flex items-center gap-2.5">
                <div className="w-[70px] shrink-0">
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="h-3 flex-1 overflow-hidden rounded-md" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="status-bar-fill h-full rounded-md"
                    style={{ width: `${getStatusPercent(s.status)}%`, background: s.color, animationDelay: `${idx * 0.05}s` }}
                  />
                </div>
                <div className="w-[30px] text-right font-mono text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {getStatusCount(s.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 维修项目排行：前三名主色低透明度徽章 */}
        <div className="card">
          <div className="section-title">维修项目热度排行</div>
          {stats.topItems?.length ? (
            <div className="flex flex-col">
              {stats.topItems.map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold"
                    style={idx < 3
                      ? { background: `rgba(94, 106, 210, ${0.28 - idx * 0.08})`, color: 'var(--primary-hover)' }
                      : { background: 'var(--surface-2)', color: 'var(--ink-subtle)' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{item.name}</div>
                    <div className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      {item.count}次 · 累计 ¥{fenToYuan(item.total)}
                    </div>
                  </div>
                  <div className="font-mono text-[14px] font-semibold" style={{ color: 'var(--danger)' }}>¥{fenToYuan(item.total)}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>

        {/* 挂账明细 */}
        <div className="card">
          <div className="flex-between mb-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>挂账明细</span>
            <span className="amount">¥{fenToYuan(stats.unpaid?.total)}</span>
          </div>
          {stats.unpaid?.list?.length ? (
            <div className="flex flex-col">
              {stats.unpaid.list.map((item: any) => (
                <div
                  key={item.id}
                  className="pressable cursor-pointer border-b py-3 last:border-b-0"
                  style={{ borderColor: 'var(--hairline)' }}
                  onClick={() => router.push(`/orders/${item.orderId}`)}
                >
                  <div className="flex-between">
                    <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{item.customerName || '未知客户'}</span>
                    <span className="font-mono text-[13px]" style={{ color: 'var(--primary-hover)' }}>{item.plateNumber}</span>
                  </div>
                  <div className="mt-1 font-mono text-[12px]" style={{ color: 'var(--ink-subtle)' }}>{item.settlementNo}</div>
                  <div className="flex-between mt-1.5">
                    <span className="text-muted">{formatDate(item.createdAt)}</span>
                    <span className="text-danger">欠 ¥{fenToYuan(item.unpaidAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无挂账" />
          )}
        </div>
      </div>
    </div>
  )
}
