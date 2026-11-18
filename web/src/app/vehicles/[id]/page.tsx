'use client'

// 车辆详情：车牌大字卡/维修统计/常见项目/所属客户/待办提醒/维修历史时间线（自旧 VehicleDetail.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { User, Wrench, MessageCircle } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import { StatusBadge } from '@/components/mobile/Badge'
import PageSkeleton from '@/components/PageSkeleton'
import { getVehicle } from '@/lib/api'
import type { Vehicle } from '@/lib/types'
import { fenToYuan } from '@/lib/money'
import { formatDateTime, getReminderTypeLabel } from '@/lib/format'

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadData = useCallback(async () => {
    setLoadFailed(false)
    try {
      setVehicle(await getVehicle(Number(id)))
    } catch {
      // 展示失败态并允许点击重试
      setLoadFailed(true)
    }
  }, [id])

  useEffect(() => { void loadData() }, [loadData])

  return (
    <div className="page-container record-page">
      <NavBar title="车辆详情" />

      {vehicle ? (
        <div className="page-content">
          {/* 车辆档案：车牌、车型和 VIN 按识别顺序排列 */}
          <div className="card record-identity">
            <div className="min-w-0">
              <div className="order-plate">{vehicle.plateNumber}</div>
              <div className="mt-2 text-[15px]" style={{ color: 'var(--ink-muted)' }}>{vehicle.brand || ''} {vehicle.model || ''}</div>
              <div className="identity-meta">
                {vehicle.year ? <span>{vehicle.year}款</span> : null}
                {vehicle.color ? <span>{vehicle.color}</span> : null}
                {vehicle.vin ? <span className="font-mono break-all">VIN: {vehicle.vin}</span> : null}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="record-summary">
              <span>维修次数 <span className="font-mono">{vehicle.stats?.totalRepairs || 0}</span></span>
              <span>累计消费 <span className={vehicle.stats?.totalSpent ? 'amount' : 'font-mono'}>¥{fenToYuan(vehicle.stats?.totalSpent)}</span></span>
              <span className="meta-line">最近维修 <time className="font-mono">{vehicle.stats?.lastRepair ? formatDateTime(vehicle.stats.lastRepair) : '暂无'}</time></span>
            </div>
            {/* 常见维修项目 */}
            {vehicle.stats?.commonItems && vehicle.stats.commonItems.length > 0 && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                <div className="text-muted mb-2">常见维修项目</div>
                <div className="flex flex-wrap gap-1.5">
                  {vehicle.stats.commonItems.map((item) => (
                    <span
                      key={item.name}
                      className="rounded-sm px-2 py-1 text-[12px]"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {item.name} ({item.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 所属客户 */}
          {vehicle.customer && (
            <div className="card">
              <div className="section-title">所属客户</div>
              <Cell
                title={
                  <span className="flex items-center gap-2">
                    <User size={17} style={{ color: 'var(--primary-hover)' }} />
                    {vehicle.customer.name}
                  </span>
                }
                label={vehicle.customer?.phone ?? ''}
                onClick={() => router.push(`/customers/${vehicle.customer?.id}`)}
              />
            </div>
          )}

          {/* 保养提醒 */}
          {vehicle.reminders && vehicle.reminders.length > 0 && (
            <div className="card">
              <div className="section-title">待办提醒 ({vehicle.reminders.length})</div>
              {vehicle.reminders.map((r) => {
                const Icon = r.type === 'maintenance' ? Wrench : MessageCircle
                return (
                  <div key={r.id} className="flex gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                    <Icon size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{getReminderTypeLabel(r.type)}</div>
                      <div className="my-0.5 text-[13px]" style={{ color: 'var(--ink-muted)' }}>{r.content || '请及时联系客户'}</div>
                      <div className="text-muted">建议日期：{formatDateTime(r.remindDate)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 维修历史时间线 */}
          <div className="card">
            <div className="section-title">维修历史 ({vehicle.workOrders?.length || 0})</div>
            {vehicle.workOrders?.length ? (
              <div className="relative pl-5">
                {vehicle.workOrders.map((o, idx, arr) => (
                  <div key={o.id} className="relative pb-5 last:pb-0">
                    {/* 时间线连线（最后一条不画） */}
                    {idx < arr.length - 1 && (
                      <span className="absolute -left-4 top-2 bottom-[-8px] w-0.5" style={{ background: 'var(--hairline)' }} />
                    )}
                    {/* 时间线节点：实心主色圆点 + 同色描边 */}
                    <span
                      className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full"
                      style={{
                        background: o.status === 'completed' ? 'var(--success)' : o.status === 'cancelled' ? 'var(--ink-tertiary)' : 'var(--primary)'
                      }}
                    />
                    <div className="pressable cursor-pointer py-1" onClick={() => router.push(`/orders/${o.id}`)}>
                      <div className="flex-between">
                        <span className="text-[12px]" style={{ color: 'var(--ink-subtle)' }}>{formatDateTime(o.createdAt)}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="mt-1 font-mono text-[14px] font-semibold">{o.orderNo}</div>
                      <div className="mt-0.5 text-[13px]" style={{ color: 'var(--ink-subtle)' }}>{o.complaint || '无诉求'}</div>
                      {/* 维修项目小标签（最多展示 3 个） */}
                      {o.repairItems && o.repairItems.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {o.repairItems.slice(0, 3).map((item) => (
                            <span key={item.id} className="rounded-sm px-2 py-1 text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                              {item.name}
                            </span>
                          ))}
                          {o.repairItems.length > 3 && (
                            <span className="rounded-sm px-2 py-1 text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                              +{o.repairItems.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {!!o.settlement?.actualAmount && (
                        <div className="mt-1.5 font-mono text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                          消费 ¥{fenToYuan(o.settlement.actualAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无维修记录" />
            )}
          </div>
        </div>
      ) : !loadFailed ? (
        <PageSkeleton cards={2} />
      ) : (
        <button type="button" className="w-full" onClick={loadData}>
          <Empty description="加载失败，点击重试" />
        </button>
      )}
    </div>
  )
}
