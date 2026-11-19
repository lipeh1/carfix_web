'use client'

// 客户详情：头像卡/消费统计/名下车辆/历史工单 + 编辑弹窗 + 底部新建接车（自旧 CustomerDetail.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Phone, Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import RepairHistory from '@/components/RepairHistory'
import PageSkeleton from '@/components/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getCustomer, updateCustomer } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { fenToYuan } from '@/lib/money'
import { formatDateTime } from '@/lib/format'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [customer, setCustomer] = useState<Customer | null>(null)
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
    if (!customer) return
    setEditForm({ name: customer.name, phone: customer.phone, remark: customer.remark || '' })
    setShowEdit(true)
  }

  const submitEdit = async () => {
    if (saving || !customer) return
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

  const hasHistory = Boolean(customer?.vehicles?.length || customer?.workOrders?.length)
  const checkin = <Button onClick={() => router.push('/checkin')}><Plus size={16} />新建接车</Button>

  return (
    <div className="page-container record-page" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
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
          {/* 客户档案以姓名和联系方式开头，不使用装饰头像 */}
          <div className="card record-identity">
            <div className="min-w-0 flex-1">
              <div className="record-name">{customer.name}</div>
              <button type="button" className="pressable mt-2 inline-flex min-h-10 items-center gap-2 font-mono text-[14px]" onClick={callPhone} style={{ color: 'var(--primary-hover)' }}><Phone size={16} />{customer.phone}</button>
            </div>
          </div>
          <div className="record-summary">
            <span>总工单 <span className="font-mono">{customer.stats?.totalOrders || 0}</span></span>
            <span>已完成 <span className="font-mono">{customer.stats?.completedOrders || 0}</span></span>
            <span>累计消费 <span className={customer.stats?.totalSpent ? 'amount' : 'font-mono'}>¥{fenToYuan(customer.stats?.totalSpent)}</span></span>
            {customer.stats?.lastVisit && <span className="meta-line">最近到店：<time className="font-mono">{formatDateTime(customer.stats.lastVisit)}</time></span>}
          </div>

          {/* 备注 */}
          {customer.remark && (
            <div className="card">
              <div className="section-title">备注</div>
              <div className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{customer.remark}</div>
            </div>
          )}

          {customer.vehicles?.length ? (
            <section className="card">
              <h2 className="section-title">名下车辆 ({customer.vehicles.length})</h2>
              {customer.vehicles.map(v => (
                <Cell key={v.id} title={<span className="order-plate">{v.plateNumber}</span>}
                  label={[v.brand, v.model].filter(Boolean).join(' ')} onClick={() => router.push(`/vehicles/${v.id}`)} />
              ))}
            </section>
          ) : hasHistory && <p className="record-empty">暂无车辆</p>}

          {customer.workOrders?.length ? (
            <section className="card">
              <h2 className="section-title">历史工单 ({customer.workOrders.length})</h2>
              <RepairHistory orders={customer.workOrders} showPlate />
            </section>
          ) : hasHistory ? <p className="record-empty">暂无历史工单</p> : (
            <Empty page description="这位客户还没有车辆和工单">{checkin}</Empty>
          )}
        </div>
      ) : !loadFailed ? (
        <PageSkeleton cards={2} />
      ) : (
        <button type="button" className="w-full" onClick={loadData}>
          <Empty description="加载失败，点击重试" />
        </button>
      )}

      {/* 底部快捷操作：材质浮层 + 安全区 */}
      {(!customer || hasHistory) && <div
        className="material-bar record-footer fixed inset-x-0 bottom-0 border-t"
        style={{ borderColor: 'var(--hairline)' }}
      >
        {checkin}
      </div>}

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
