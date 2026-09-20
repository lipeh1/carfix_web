'use client'

// 客户详情：头像卡/消费统计/名下车辆/历史工单 + 编辑弹窗 + 底部新建接车（自旧 CustomerDetail.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Phone, CarFront, Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import { StatusBadge } from '@/components/mobile/Badge'
import PageSkeleton from '@/components/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getCustomer, updateCustomer } from '@/lib/api'
import { fenToYuan } from '@/lib/money'
import { formatDateTime } from '@/lib/format'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [customer, setCustomer] = useState<any>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', remark: '' })
  // 保存中状态：防弱网双击重复提交
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoadFailed(false)
    try {
      setCustomer(await getCustomer(Number(id)))
    } catch {
      // 展示失败态并允许点击重试
      setLoadFailed(true)
    }
  }, [id])

  useEffect(() => { void loadData() }, [loadData])

  const callPhone = () => {
    if (customer?.phone) window.location.href = `tel:${customer.phone}`
  }

  const openEdit = () => {
    setEditForm({ name: customer.name, phone: customer.phone, remark: customer.remark || '' })
    setShowEdit(true)
  }

  const submitEdit = async () => {
    if (saving) return
    if (!editForm.name) return toast('请输入姓名')
    if (!editForm.phone) return toast('请输入电话')
    setSaving(true)
    try {
      await updateCustomer(customer.id, editForm)
      toast.success('保存成功')
      setShowEdit(false)
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <NavBar
        title="客户详情"
        right={
          <button type="button" aria-label="编辑" className="pressable" onClick={openEdit}>
            <Pencil size={18} />
          </button>
        }
      />

      {customer ? (
        <div className="page-content">
          {/* 客户信息卡片：表面2浮层 + 主色低透明度头像底 */}
          <div className="card flex items-center gap-3" style={{ background: 'var(--surface-2)' }}>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-[20px] font-semibold"
              style={{ background: 'rgba(94, 106, 210, 0.2)', color: 'var(--primary-hover)' }}
            >
              {customer.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>{customer.name}</div>
              <button
                type="button"
                className="pressable mt-0.5 font-mono text-[13px]"
                style={{ color: 'var(--ink-muted)' }}
                onClick={callPhone}
              >
                {customer.phone}
              </button>
            </div>
            <Phone size={22} className="pressable shrink-0" style={{ color: 'var(--ink-muted)' }} onClick={callPhone} />
          </div>

          {/* 消费统计 */}
          <div className="card">
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-[20px] font-bold" style={{ letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                  {customer.stats?.totalOrders || 0}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>总工单</div>
              </div>
              <div className="text-center">
                <div className="text-success text-[20px] font-bold" style={{ letterSpacing: '-0.02em' }}>
                  {customer.stats?.completedOrders || 0}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>已完成</div>
              </div>
              <div className="text-center">
                <div className="text-danger text-[20px] font-bold" style={{ letterSpacing: '-0.02em' }}>
                  ¥{fenToYuan(customer.stats?.totalSpent)}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>累计消费</div>
              </div>
            </div>
            {customer.stats?.lastVisit && (
              <div className="text-muted mt-3">最近到店：{formatDateTime(customer.stats.lastVisit)}</div>
            )}
          </div>

          {/* 备注 */}
          {customer.remark && (
            <div className="card">
              <div className="section-title">备注</div>
              <div className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{customer.remark}</div>
            </div>
          )}

          {/* 名下车辆 */}
          <div className="card">
            <div className="section-title">名下车辆 ({customer.vehicles?.length || 0})</div>
            {customer.vehicles?.map((v: any) => (
              <Cell
                key={v.id}
                title={
                  <span className="flex items-center gap-2">
                    <CarFront size={17} style={{ color: 'var(--primary-hover)' }} />
                    <span className="font-mono">{v.plateNumber}</span>
                  </span>
                }
                label={`${v.brand || ''} ${v.model || ''}`}
                onClick={() => router.push(`/vehicles/${v.id}`)}
              />
            ))}
            {!customer.vehicles?.length && <Empty description="暂无车辆" />}
          </div>

          {/* 历史工单 */}
          <div className="card">
            <div className="section-title">历史工单 ({customer.workOrders?.length || 0})</div>
            {customer.workOrders?.map((o: any) => (
              <div key={o.id} className="pressable cursor-pointer border-b py-3 last:border-b-0" style={{ borderColor: 'var(--hairline)' }} onClick={() => router.push(`/orders/${o.id}`)}>
                <div className="flex-between">
                  <span className="font-mono text-[14px] font-semibold">{o.orderNo}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-1 text-[13px]" style={{ color: 'var(--primary-hover)' }}>
                  {o.vehicle?.plateNumber || '未知车辆'}
                </div>
                <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--ink-subtle)' }}>
                  {o.complaint || '无诉求'}
                </div>
                <div className="flex-between mt-1.5">
                  <span className="text-muted">{formatDateTime(o.createdAt)}</span>
                  {!!o.settlement?.actualAmount && (
                    <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--danger)' }}>
                      ¥{fenToYuan(o.settlement.actualAmount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!customer.workOrders?.length && <Empty description="暂无工单" />}
          </div>
        </div>
      ) : !loadFailed ? (
        <PageSkeleton cards={2} />
      ) : (
        <button type="button" className="w-full" onClick={loadData}>
          <Empty description="加载失败，点击重试" />
        </button>
      )}

      {/* 底部快捷操作：材质浮层 + 安全区 */}
      <div
        className="material-bar fixed inset-x-0 bottom-0 border-t"
        style={{ borderColor: 'var(--hairline)', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}
      >
        <Button className="h-10 w-full" onClick={() => router.push('/checkin')}>
          <Plus size={16} /> 新建接车
        </Button>
      </div>

      {/* 编辑客户弹窗 */}
      <BottomSheet open={showEdit} onOpenChange={setShowEdit} title="编辑客户">
        <div className="flex flex-col gap-3">
          <Field label="姓名">
            <Input value={editForm.name} placeholder="请输入姓名" onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="电话">
            <Input type="tel" value={editForm.phone} placeholder="请输入电话" onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="备注">
            <Textarea rows={2} value={editForm.remark} placeholder="可选" onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" disabled={saving} onClick={submitEdit}>保存</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
