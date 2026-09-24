'use client'

// 工单详情：接车/维修/结算信息展示 + 状态流转 + 挂账补款 + 报价长图（自旧 OrderDetail.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Loader2 } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import ImagePreview from '@/components/mobile/ImagePreview'
import { Badge } from '@/components/mobile/Badge'
import PageSkeleton from '@/components/PageSkeleton'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  getOrder, updateOrderStatus, addRepairLog,
  addAdditionalItem, confirmAdditionalItem, createQualityCheck,
  createSettlement, addPayment, deliverOrder, updateCheckin
} from '@/lib/api'
import type { WorkOrder, AdditionalItem } from '@/lib/types'
import { fenToYuan, yuanToFen } from '@/lib/money'
import { formatDateTime, getPaymentMethodLabel } from '@/lib/format'
import { hapticFeedback } from '@/lib/feedback'
import { generateQuoteCard } from '@/lib/quoteCard'

// 本页状态标签：pending_quote 在详情语境下强调「待报价确认」
const STATUS_LABELS: Record<string, { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'default' }> = {
  pending_inspection: { label: '待检测', tone: 'warning' },
  pending_quote: { label: '待报价确认', tone: 'primary' },
  repairing: { label: '维修中', tone: 'danger' },
  pending_quality_check: { label: '待质检', tone: 'warning' },
  pending_settlement: { label: '待结算', tone: 'primary' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'default' }
}

// 底部操作按钮定义（根据当前状态动态显示）
interface ActionButton {
  key: string
  label: string
  tone: 'primary' | 'default' | 'success' | 'danger'
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const confirm = useConfirm()
  const orderId = Number(id)

  // 工单数据
  const [order, setOrder] = useState<WorkOrder | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  // 弹窗状态
  const [showEditCheckin, setShowEditCheckin] = useState(false)
  const [showLogPopup, setShowLogPopup] = useState(false)
  const [showAdditionalPopup, setShowAdditionalPopup] = useState(false)
  const [showPaymentPopup, setShowPaymentPopup] = useState(false)
  const [showDeliverPopup, setShowDeliverPopup] = useState(false)

  // 表单与防重复提交状态
  const [editCheckinForm, setEditCheckinForm] = useState({ complaint: '', mileageIn: '', vehicleCondition: '' })
  const [savingCheckin, setSavingCheckin] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [additionalForm, setAdditionalForm] = useState({ name: '', amount: '', reason: '' })
  const [addingItem, setAddingItem] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash' })
  const [paying, setPaying] = useState(false)
  const [deliverMileage, setDeliverMileage] = useState('')
  const [delivering, setDelivering] = useState(false)

  // 图片预览：photos=接车照片（无保存按钮）/ quote=报价单长图（带保存按钮）
  const [showPreview, setShowPreview] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState<'photos' | 'quote'>('photos')
  const [savingImage, setSavingImage] = useState(false)

  const checkinPhotos = order?.checkinPhotos || []
  const repairItems = order?.repairItems || []
  const repairLogs = order?.repairLogs || []
  const additionalItems = order?.additionalItems || []
  const settlement = order?.settlement || null

  // 维修项目合计
  const itemsTotal = repairItems.reduce((sum, i) => sum + Number(i.subtotal), 0)
  // 待收金额
  const unpaidAmount = settlement ? Number(settlement.actualAmount) - Number(settlement.paidAmount) : 0
  // 增项必须在结算前处理，结算后不再改变已确认的收费明细
  const canProcessAdditional = ['repairing', 'pending_quality_check'].includes(order?.status ?? '') && !settlement

  const loadData = useCallback(async () => {
    setLoadFailed(false)
    try {
      setOrder(await getOrder(orderId))
    } catch {
      // 展示失败态并允许点击重试，而非永远停留在「加载中」
      setLoadFailed(true)
    }
  }, [orderId])

  useEffect(() => { void loadData() }, [loadData])

  // 底部操作按钮（根据当前状态动态显示）
  const actionButtons: ActionButton[] = (() => {
    const s = order?.status
    const btns: ActionButton[] = []
    if (s === 'pending_inspection') {
      btns.push({ key: 'go_quote', label: '去检测报价', tone: 'primary' })
    }
    if (s === 'pending_quote') {
      btns.push({ key: 'share_quote', label: '报价图片', tone: 'default' })
      btns.push({ key: 'confirm_quote', label: '客户确认报价', tone: 'primary' })
      btns.push({ key: 'cancel', label: '取消维修', tone: 'danger' })
    }
    if (s === 'repairing') {
      btns.push({ key: 'add_log', label: '记录维修', tone: 'default' })
      btns.push({ key: 'add_item', label: '新增增项', tone: 'default' })
      btns.push({ key: 'finish_repair', label: '维修完成', tone: 'primary' })
    }
    if (s === 'pending_quality_check') {
      btns.push({ key: 'qc_pass', label: '质检通过', tone: 'success' })
      btns.push({ key: 'qc_fail', label: '质检不通过', tone: 'danger' })
    }
    // 保留历史待结算工单缺少结算单时的建账入口，已结清工单不再显示收款
    if ((s === 'pending_settlement' && (!settlement || unpaidAmount > 0))
      || (s === 'completed' && unpaidAmount > 0)) {
      btns.push({ key: 'receive_payment', label: s === 'completed' ? '补款' : '收款', tone: 'primary' })
    }
    if (s === 'pending_settlement') {
      btns.push({ key: 'deliver', label: '交车', tone: 'success' })
    }
    return btns
  })()

  // 图片预览（定位到所点击的照片，而非每次都从头看）
  const openPreview = (idx: number) => {
    setPreviewImages(checkinPhotos.map((p) => p.filePath))
    setPreviewIndex(idx)
    setPreviewMode('photos')
    setShowPreview(true)
  }

  // 报价单保存：dataURL 转 Blob 后走 <a download> 下载；
  // 不支持 download 的环境（如微信 iOS）由提示文案兜底「长按保存」
  const saveQuoteImage = async () => {
    const url = previewImages[0]
    if (!url || savingImage) return
    setSavingImage(true)
    try {
      const blob = await (await fetch(url)).blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `报价单-${order?.orderNo || ''}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      hapticFeedback()
      toast.success('已调起保存')
    } catch {
      toast('当前浏览器不支持直接保存，请长按图片保存')
    } finally {
      setSavingImage(false)
    }
  }

  // ===== 编辑接车信息 =====
  const openEditCheckin = () => {
    if (!order) return
    setEditCheckinForm({
      complaint: order.complaint || '',
      mileageIn: order.mileageIn ? String(order.mileageIn) : '',
      vehicleCondition: order.checkinRecord?.vehicleCondition || ''
    })
    setShowEditCheckin(true)
  }

  const submitEditCheckin = async () => {
    if (!editCheckinForm.complaint) return toast('客户诉求不能为空')
    setSavingCheckin(true)
    try {
      await updateCheckin(orderId, editCheckinForm)
      toast.success('保存成功')
      setShowEditCheckin(false)
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setSavingCheckin(false)
    }
  }

  // ===== 维修记录 =====
  const submitLog = async () => {
    if (!logContent) return toast('请输入维修内容')
    try {
      await addRepairLog(orderId, logContent)
      toast.success('已记录')
      setShowLogPopup(false)
      setLogContent('')
      void loadData()
    } catch { /* 已拦截 */ }
  }

  // ===== 增项 =====
  const submitAdditional = async () => {
    if (addingItem) return
    if (!additionalForm.name) return toast('请输入项目名称')
    // 输入为「元」，校验有效后换算为整数分提交
    const amountYuan = Number(additionalForm.amount)
    if (!additionalForm.amount || !Number.isFinite(amountYuan) || amountYuan <= 0) {
      return toast('请输入有效的费用金额')
    }
    setAddingItem(true)
    try {
      await addAdditionalItem(orderId, {
        name: additionalForm.name,
        amount: yuanToFen(amountYuan),
        reason: additionalForm.reason
      })
      toast.success('增项已提交，待客户确认')
      setShowAdditionalPopup(false)
      setAdditionalForm({ name: '', amount: '', reason: '' })
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setAddingItem(false)
    }
  }

  // 确认或拒绝增项
  const handleConfirmAdditional = async (item: AdditionalItem, confirmed: boolean) => {
    const ok = confirmed
      ? await confirm({
          title: '确认增项',
          message: `确认添加「${item.name}」（¥${fenToYuan(item.amount)}）？确认后将计入维修项目和结算金额。`
        })
      : await confirm({ title: '拒绝增项', message: `确定拒绝「${item.name}」？` })
    if (!ok) return
    try {
      await confirmAdditionalItem(item.id, confirmed)
      hapticFeedback()
      toast.success(confirmed ? '增项已确认' : '增项已拒绝')
      void loadData()
    } catch { /* 已拦截 */ }
  }

  // ===== 收款 =====
  const submitPayment = async () => {
    if (paying) return
    // 输入为「元」，校验有效后换算为整数分提交
    const amountYuan = Number(paymentForm.amount)
    if (!paymentForm.amount || !Number.isFinite(amountYuan) || amountYuan <= 0) {
      return toast('请输入有效的收款金额')
    }
    setPaying(true)
    try {
      // 无结算单时先建单（带上报价阶段登记的优惠），用返回值避免读取过期状态
      let s = settlement
      if (!s) {
        s = await createSettlement(orderId, { discount: Number(order?.discount) || 0 })
        await loadData()
      }
      await addPayment(s.id, {
        amount: yuanToFen(amountYuan),
        method: paymentForm.method,
        type: s.paidAmount > 0 ? 'supplement' : 'initial'
      })
      hapticFeedback()
      toast.success('收款成功')
      setShowPaymentPopup(false)
      setPaymentForm(f => ({ ...f, amount: '' }))
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setPaying(false)
    }
  }

  // ===== 交车 =====
  const submitDeliver = async () => {
    if (delivering) return
    // 交车里程为整数，选填
    const mileage = deliverMileage ? Number(deliverMileage) : null
    if (mileage !== null && !Number.isFinite(mileage)) {
      return toast('请输入有效的交车里程')
    }
    setDelivering(true)
    try {
      await deliverOrder(orderId, { mileageOut: mileage })
      hapticFeedback()
      toast.success('交车完成')
      setShowDeliverPopup(false)
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setDelivering(false)
    }
  }

  // ===== 操作按钮处理 =====
  const handleAction = async (key: string) => {
    try {
      switch (key) {
        case 'go_quote':
          // 跳转到独立的检测报价页面
          router.push(`/orders/${orderId}/quote`)
          break
        case 'share_quote': {
          // 生成报价单长图，预览后长按保存/微信转发给客户
          if (!order) break
          // 独立捕获：手机浏览器 canvas 兼容问题不能静默，
          // 否则表现为「点了没反应」无从排查
          try {
            const dataUrl = await generateQuoteCard({
              orderNo: order.orderNo,
              plateNumber: order.vehicle?.plateNumber,
              customerName: order.customer?.name,
              mileageIn: order.mileageIn,
              createdAt: order.createdAt,
              quoteAmount: order.quoteAmount,
              discount: order.discount,
              repairItems: (repairItems || []).map((i) => ({
                name: i.name, type: i.type, quantity: i.quantity,
                unitPrice: i.unitPrice, subtotal: i.subtotal
              }))
            })
            setPreviewImages([dataUrl])
            setPreviewIndex(0)
            setPreviewMode('quote')
            // 延迟打开：避开本次触摸的事件序列，防止 iOS 上
            // 预览遮罩刚挂载就被同一次 tap 穿透关闭
            setTimeout(() => setShowPreview(true), 100)
            toast('点击下方按钮保存图片，或长按图片转发客户')
          } catch (err) {
            toast.error('图片生成失败：' + ((err as Error)?.message || '未知原因'))
          }
          break
        }
        case 'confirm_quote':
          await updateOrderStatus(orderId, 'repairing')
          toast.success('已确认，开始维修')
          void loadData()
          break
        case 'cancel':
          if (!(await confirm({ title: '确认取消', message: '确定取消该工单？', danger: true }))) return
          await updateOrderStatus(orderId, 'cancelled')
          toast('已取消')
          void loadData()
          break
        case 'add_log':
          setLogContent('')
          setShowLogPopup(true)
          break
        case 'add_item':
          setAdditionalForm({ name: '', amount: '', reason: '' })
          setShowAdditionalPopup(true)
          break
        case 'finish_repair':
          await updateOrderStatus(orderId, 'pending_quality_check')
          toast.success('维修完成，待质检')
          void loadData()
          break
        case 'qc_pass':
          await createQualityCheck(orderId, { result: 'pass' })
          hapticFeedback()
          toast.success('质检通过，待结算')
          void loadData()
          break
        case 'qc_fail':
          await createQualityCheck(orderId, { result: 'fail' })
          toast('质检不通过，已返回维修')
          void loadData()
          break
        case 'receive_payment': {
          // 无结算单时先建单（沿用报价阶段登记的优惠），以返回值计算待收
          let s = settlement
          if (!s) {
            s = await createSettlement(orderId, { discount: Number(order?.discount) || 0 })
            await loadData()
          }
          const unpaid = Number(s.actualAmount) - Number(s.paidAmount)
          setPaymentForm(f => ({ ...f, amount: unpaid > 0 ? fenToYuan(unpaid) : '' }))
          setShowPaymentPopup(true)
          break
        }
        case 'deliver':
          // 打开交车弹窗，录入交车里程后确认
          setDeliverMileage('')
          setShowDeliverPopup(true)
          break
        default:
          toast('功能开发中')
      }
    } catch { /* 已拦截 */ }
  }

  const statusInfo = STATUS_LABELS[order?.status ?? ''] || { label: order?.status ?? '', tone: 'default' as const }

  return (
    <div className="page-container" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <NavBar title={`工单 #${order?.orderNo || ''}`} />

      {order ? (
        <div className="page-content">
          {/* 状态卡片 */}
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div className="flex-between">
              <div className="min-w-0">
                <div className="font-mono text-[20px] font-bold" style={{ letterSpacing: 1 }}>{order.vehicle?.plateNumber}</div>
                <div className="text-muted mt-2">{order.customer?.name} · {order.customer?.phone}</div>
              </div>
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            </div>
          </div>

          {/* 接车信息 */}
          <div className="card">
            <div className="flex-between">
              <span className="section-title">接车信息</span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={openEditCheckin}>
                <Pencil size={13} /> 编辑
              </Button>
            </div>
            <Cell title="客户诉求" right={<span style={{ color: 'var(--ink)' }}>{order.complaint || '-'}</span>} />
            <Cell title="接车里程" right={<span style={{ color: 'var(--ink)' }}>{order.mileageIn ? order.mileageIn + ' km' : '-'}</span>} />
            <Cell title="车况描述" right={<span style={{ color: 'var(--ink)' }}>{order.checkinRecord?.vehicleCondition || '-'}</span>} />
            <Cell title="创建时间" right={<span style={{ color: 'var(--ink)' }}>{formatDateTime(order.createdAt)}</span>} />
          </div>

          {/* 接车照片 */}
          {checkinPhotos.length > 0 && (
            <div className="card">
              <div className="section-title">接车照片</div>
              <div className="flex flex-wrap gap-2">
                {checkinPhotos.map((photo, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.filePath}
                    alt=""
                    className="pressable h-20 w-20 cursor-pointer rounded-lg border object-cover"
                    style={{ borderColor: 'var(--hairline)' }}
                    onClick={() => openPreview(idx)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 检测结果 */}
          {order.inspection && (
            <div className="card">
              <div className="section-title">检测结果</div>
              <div className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{order.inspection}</div>
            </div>
          )}

          {/* 维修项目 */}
          {repairItems.length > 0 && (
            <div className="card">
              <div className="section-title">维修项目 / 配件</div>
              {repairItems.map((item) => (
                <Cell
                  key={item.id}
                  title={item.name}
                  label={`${item.type === 'service' ? '工时' : '配件'} × ${item.quantity}`}
                  right={<span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(item.subtotal)}</span>}
                />
              ))}
              <div className="flex-between mt-3">
                <span>合计</span>
                <span className="amount">¥{fenToYuan(itemsTotal)}</span>
              </div>
            </div>
          )}

          {/* 维修记录 */}
          {repairLogs.length > 0 && (
            <div className="card">
              <div className="section-title">维修记录</div>
              {repairLogs.map((log) => (
                <div key={log.id} className="border-b py-2 last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                  <div className="mb-1 text-[14px]" style={{ color: 'var(--ink)' }}>{log.content}</div>
                  <div className="text-muted">{formatDateTime(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )}

          {/* 增项 */}
          {additionalItems.length > 0 && (
            <div className="card">
              <div className="section-title">维修增项</div>
              {additionalItems.map((item) => (
                <div key={item.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                  <Cell
                    title={item.name}
                    label={item.reason}
                    right={
                      <span className="flex flex-col items-end gap-1">
                        <span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(item.amount)}</span>
                        <Badge tone={item.status === 'confirmed' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>
                          {item.status === 'confirmed' ? '已确认' : item.status === 'rejected' ? '已拒绝' : '待确认'}
                        </Badge>
                      </span>
                    }
                  />
                  {/* 待确认增项的操作按钮 */}
                  {item.status === 'pending' && canProcessAdditional && (
                    <div className="flex justify-end gap-2 pb-3">
                      <Button size="sm" className="h-8" onClick={() => handleConfirmAdditional(item, true)}>确认</Button>
                      <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => handleConfirmAdditional(item, false)}>拒绝</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 结算信息 */}
          {settlement && (
            <div className="card">
              <div className="section-title">结算信息</div>
              <Cell title="结算单号" right={<span className="font-mono" style={{ color: 'var(--ink)' }}>{settlement.settlementNo}</span>} />
              <Cell title="应收金额" right={<span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(settlement.totalAmount)}</span>} />
              <Cell title="优惠" right={<span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(settlement.discount || 0)}</span>} />
              <Cell title="实收金额" right={<span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(settlement.actualAmount)}</span>} />
              <Cell title="已收金额" right={<span className="font-mono" style={{ color: 'var(--ink)' }}>¥{fenToYuan(settlement.paidAmount)}</span>} />
              <Cell
                title="状态"
                right={<Badge tone={settlement.status === 'paid' ? 'success' : 'warning'}>{settlement.status === 'paid' ? '已结清' : '挂账'}</Badge>}
              />
              {/* 收款记录 */}
              {settlement.payments && settlement.payments.length > 0 && (
                <div className="mt-3">
                  <div className="text-muted mb-2">收款记录</div>
                  {settlement.payments.map((p) => (
                    <div key={p.id} className="flex-between border-b py-1.5 font-mono text-[13px] last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                      <span>{formatDateTime(p.createdAt)} · {getPaymentMethodLabel(p.method)}</span>
                      <span className="text-success">+¥{fenToYuan(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 底部操作栏：材质浮层 + 安全区 */}
          {actionButtons.length > 0 && (
            <div
              className="material-bar fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t"
              style={{ borderColor: 'var(--hairline)', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}
            >
              {actionButtons.map(btn => (
                <Button
                  key={btn.key}
                  variant={btn.tone === 'primary' ? 'default' : btn.tone === 'default' ? 'outline' : btn.tone === 'success' ? 'default' : 'outline'}
                  className={
                    btn.tone === 'success'
                      ? 'h-10 flex-1 bg-[var(--success)] text-white hover:bg-[var(--success)]/90'
                      : btn.tone === 'danger'
                        ? 'h-10 flex-1 text-destructive'
                        : 'h-10 flex-1'
                  }
                  onClick={() => handleAction(btn.key)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : !loadFailed ? (
        <PageSkeleton cards={3} />
      ) : (
        <button type="button" className="w-full" onClick={loadData}>
          <Empty description="加载失败，点击重试" />
        </button>
      )}

      {/* 全屏图片预览：置于页面根级无条件渲染，
          报价单模式下提供显式保存按钮（长按保存仅部分环境有效） */}
      {showPreview && (
        <ImagePreview
          images={previewImages}
          index={previewIndex}
          onClose={() => setShowPreview(false)}
          cover={previewMode === 'quote' ? (
            <div className="w-full">
              <Button className="h-10 w-full" disabled={savingImage} onClick={saveQuoteImage}>
                {savingImage && <Loader2 className="animate-spin" />}
                保存图片
              </Button>
              <div className="mt-2 text-center text-[12px]" style={{ color: 'var(--ink-subtle)' }}>
                保存后可发送给客户确认
              </div>
            </div>
          ) : undefined}
        />
      )}

      {/* ===== 编辑接车信息弹窗 ===== */}
      <BottomSheet open={showEditCheckin} onOpenChange={setShowEditCheckin} title="编辑接车信息">
        <div className="flex flex-col gap-3">
          <Field label="客户诉求">
            <Textarea rows={2} value={editCheckinForm.complaint} placeholder="描述故障或需求"
              onChange={e => setEditCheckinForm(f => ({ ...f, complaint: e.target.value }))} />
          </Field>
          <Field label="接车里程">
            <Input inputMode="numeric" value={editCheckinForm.mileageIn} placeholder="公里数"
              onChange={e => setEditCheckinForm(f => ({ ...f, mileageIn: e.target.value }))} />
          </Field>
          <Field label="车况描述">
            <Textarea rows={2} value={editCheckinForm.vehicleCondition} placeholder="可选"
              onChange={e => setEditCheckinForm(f => ({ ...f, vehicleCondition: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" disabled={savingCheckin} onClick={submitEditCheckin}>保存</Button>
        </div>
      </BottomSheet>

      {/* ===== 维修记录弹窗 ===== */}
      <BottomSheet open={showLogPopup} onOpenChange={setShowLogPopup} title="记录维修">
        <div className="flex flex-col gap-3">
          <Field label="维修内容">
            <Textarea rows={3} value={logContent} placeholder="描述维修过程和操作"
              onChange={e => setLogContent(e.target.value)} />
          </Field>
          <Button className="mt-2 h-10" onClick={submitLog}>保存</Button>
        </div>
      </BottomSheet>

      {/* ===== 增项弹窗 ===== */}
      <BottomSheet open={showAdditionalPopup} onOpenChange={setShowAdditionalPopup} title="新增增项">
        <div className="flex flex-col gap-3">
          <Field label="项目名称">
            <Input value={additionalForm.name} placeholder="如更换刹车片"
              onChange={e => setAdditionalForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="费用（元）">
            <Input inputMode="decimal" value={additionalForm.amount} placeholder="元"
              onChange={e => setAdditionalForm(f => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="原因">
            <Textarea rows={2} value={additionalForm.reason} placeholder="说明新增原因"
              onChange={e => setAdditionalForm(f => ({ ...f, reason: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" disabled={addingItem} onClick={submitAdditional}>提交增项</Button>
        </div>
      </BottomSheet>

      {/* ===== 收款弹窗 ===== */}
      <BottomSheet open={showPaymentPopup} onOpenChange={setShowPaymentPopup} title="收款">
        {settlement && (
          <div className="mb-3 rounded-lg border p-3 text-[14px]" style={{ borderColor: 'var(--hairline)', background: 'var(--surface-2)' }}>
            <div className="flex-between"><span>应收金额</span><span className="font-mono">¥{fenToYuan(settlement.totalAmount)}</span></div>
            {Number(settlement.discount) > 0 && (
              <div className="flex-between mt-2"><span className="text-success">优惠</span><span className="text-success font-mono">-¥{fenToYuan(settlement.discount)}</span></div>
            )}
            <div className="flex-between mt-2"><span>已收金额</span><span className="font-mono">¥{fenToYuan(settlement.paidAmount)}</span></div>
            <div className="flex-between mt-2"><span className="text-danger">待收金额</span><span className="text-danger font-mono">¥{fenToYuan(unpaidAmount)}</span></div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Field label="收款金额（元）">
            <Input inputMode="decimal" value={paymentForm.amount} placeholder="元"
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="收款方式">
            <RadioGroup
              value={paymentForm.method}
              onValueChange={v => setPaymentForm(f => ({ ...f, method: v }))}
              className="grid grid-cols-3 gap-2"
            >
              {[
                ['cash', '现金'], ['wechat', '微信'], ['alipay', '支付宝'], ['card', '刷卡'], ['transfer', '转账']
              ].map(([v, label]) => (
                <Label key={v} className="flex items-center gap-2 text-[14px] font-normal" style={{ color: 'var(--ink)' }}>
                  <RadioGroupItem value={v} /> {label}
                </Label>
              ))}
            </RadioGroup>
          </Field>
          <Button className="mt-2 h-10" disabled={paying} onClick={submitPayment}>
            {paying && <Loader2 className="animate-spin" />}
            确认收款
          </Button>
        </div>
      </BottomSheet>

      {/* ===== 交车弹窗 ===== */}
      <BottomSheet open={showDeliverPopup} onOpenChange={setShowDeliverPopup} title="确认交车">
        <div className="flex flex-col gap-3">
          <Field label="交车里程">
            <Input inputMode="numeric" value={deliverMileage} placeholder="公里数，可不填"
              onChange={e => setDeliverMileage(e.target.value)} />
          </Field>
          <div className="text-muted px-1">交车后工单完成，将自动创建回访与保养提醒</div>
          <Button className="h-10" disabled={delivering} onClick={submitDeliver}>
            {delivering && <Loader2 className="animate-spin" />}
            确认交车
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
