'use client'

// 检测报价编辑器：工时/配件两组条目 + 常用预设/小保养模板/复制上次 + 草稿（自旧 Quote.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { X, Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import ScrollTabs from '@/components/mobile/ScrollTabs'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { getOrder, saveQuote, getLastQuote } from '@/lib/api'
import { fenToYuan, yuanToFen } from '@/lib/money'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft'

// 报价条目（页面内金额均为「元」字符串，提交/载入时才与后端的「分」换算）
interface QuoteItem {
  _id: string
  type: 'service' | 'part'
  name: string
  quantity: string
  unitPrice: string
  subtotal: number
}

// 常用项目预设
const PRESETS = {
  service: [
    { name: '发动机检测', price: 200 },
    { name: '刹车系统检测', price: 150 },
    { name: '四轮定位', price: 180 },
    { name: '机油更换工时', price: 50 },
    { name: '空调清洗', price: 120 },
    { name: '轮胎更换工时', price: 80 },
    { name: '电瓶更换工时', price: 30 },
    { name: '变速箱保养', price: 300 },
    { name: '节气门清洗', price: 100 },
    { name: '喷油嘴清洗', price: 150 },
    { name: '三元催化清洗', price: 200 },
    { name: '底盘检查', price: 100 }
  ],
  part: [
    { name: '机油（4L）', price: 280 },
    { name: '机油滤芯', price: 35 },
    { name: '空气滤芯', price: 50 },
    { name: '空调滤芯', price: 45 },
    { name: '前刹车片', price: 280 },
    { name: '后刹车片', price: 260 },
    { name: '刹车油', price: 80 },
    { name: '火花塞（4支）', price: 200 },
    { name: '电瓶', price: 450 },
    { name: '轮胎（条）', price: 400 },
    { name: '雨刮片（对）', price: 60 },
    { name: '防冻液', price: 120 }
  ]
}

// 小保养一键模板：最高频场景，生成后可改数量单价
const MINOR_MAINTENANCE = [
  { type: 'part' as const, name: '机油（4L）', price: 280 },
  { type: 'part' as const, name: '机油滤芯', price: 35 },
  { type: 'service' as const, name: '机油更换工时', price: 50 }
]

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const formatAmount = (n: number | string) => Number(n || 0).toFixed(2)

export default function QuotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const confirm = useConfirm()
  const orderId = Number(id)

  // 报价表单草稿键（按工单隔离）
  const DRAFT_KEY = 'quote:' + orderId

  const [inspection, setInspection] = useState('')
  const [discount, setDiscount] = useState('0')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [saving, setSaving] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [pickerTab, setPickerTab] = useState('service')
  // 服务端数据是否已载入完成（之后再开始记录草稿）
  const [loaded, setLoaded] = useState(false)

  const serviceItems = items.filter(i => i.type === 'service')
  const partItems = items.filter(i => i.type === 'part')
  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0)
  const finalAmount = Math.max(0, itemsTotal - (Number(discount) || 0))

  // 计算小计（更新条目时同步）
  const updateItem = (itemId: string, patch: Partial<QuoteItem>) => {
    setItems(prev => prev.map(i => {
      if (i._id !== itemId) return i
      const next = { ...i, ...patch }
      next.subtotal = Number(next.quantity || 0) * Number(next.unitPrice || 0)
      return next
    }))
  }

  const addItem = (type: 'service' | 'part') => {
    setItems(prev => [...prev, { _id: genId(), type, name: '', quantity: '1', unitPrice: '', subtotal: 0 }])
  }

  // 添加预设项目：同名项目数量 +1，否则新增
  const addPresetItem = (preset: { name: string; price: number }) => {
    const type = pickerTab as 'service' | 'part'
    setItems(prev => {
      const existing = prev.find(i => i.name === preset.name && i.type === type)
      if (existing) {
        toast('已添加到现有项目')
        return prev.map(i => i._id === existing._id
          ? { ...i, quantity: String(Number(i.quantity) + 1), subtotal: (Number(i.quantity) + 1) * Number(i.unitPrice || 0) }
          : i)
      }
      return [...prev, { _id: genId(), type, name: preset.name, quantity: '1', unitPrice: String(preset.price), subtotal: preset.price }]
    })
    setShowItemPicker(false)
  }

  // 删除项目
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i._id !== itemId))
  }

  // 复制这辆车上次已完成工单的报价项目（接口金额为分，转为元）
  const copyLastItems = async () => {
    try {
      const data = await getLastQuote(orderId)
      if (!data.order || !data.items || data.items.length === 0) {
        return toast('这辆车还没有已完成的历史工单')
      }
      setItems(prev => {
        const next = [...prev]
        for (const it of data.items) {
          const existing = next.find(i => i.name === it.name && i.type === it.type)
          if (existing) {
            existing.quantity = String(Number(existing.quantity) + it.quantity)
            existing.subtotal = Number(existing.quantity) * Number(existing.unitPrice)
          } else {
            next.push({
              _id: genId(),
              type: it.type as 'service' | 'part',
              name: it.name,
              quantity: String(it.quantity),
              unitPrice: fenToYuan(it.unitPrice),
              subtotal: it.subtotal / 100
            })
          }
        }
        return next
      })
      toast.success(`已带入 ${data.order.orderNo} 的 ${data.items.length} 项`)
    } catch { /* 已拦截 */ }
  }

  // 小保养一键模板
  const applyMinorMaintenance = () => {
    setItems(prev => {
      const next = [...prev]
      for (const t of MINOR_MAINTENANCE) {
        const existing = next.find(i => i.name === t.name && i.type === t.type)
        if (existing) {
          existing.quantity = String(Number(existing.quantity) + 1)
          existing.subtotal = Number(existing.quantity) * Number(existing.unitPrice)
        } else {
          next.push({ _id: genId(), type: t.type, name: t.name, quantity: '1', unitPrice: String(t.price), subtotal: t.price })
        }
      }
      return next
    })
    toast.success('已生成小保养项目，可调整数量价格')
  }

  // 加载已有报价数据
  const loadExistingQuote = useCallback(async () => {
    try {
      const order = await getOrder(orderId)
      // 检测结果用独立的 inspection 字段回填（与客户诉求 complaint 是两回事）
      setInspection(order.inspection || '')
      // 回显报价时登记的优惠（接口返回分，输入为元）
      setDiscount(fenToYuan(order.discount))
      if (order.repairItems && order.repairItems.length > 0) {
        // 只载入报价来源的项目：增项有独立的确认流程，
        // 若混入编辑列表，再次保存报价会重建出重复项目，造成双重计费
        const quoteItems = order.repairItems.filter(i => i.source === 'quote')
        setItems(quoteItems.map(item => ({
          _id: genId(),
          type: item.type as 'service' | 'part',
          name: item.name,
          quantity: String(item.quantity),
          unitPrice: fenToYuan(item.unitPrice),
          subtotal: item.subtotal / 100
        })))
      }
    } catch { /* 静默 */ }
  }, [orderId])

  // 保存报价
  const saveQuoteHandler = async () => {
    if (items.length === 0) {
      return toast('请至少添加一个维修项目')
    }
    // 校验项目名称必填；数量为正数；单价允许小数且不能为负
    const invalid = items.find(
      i => !i.name
        || i.unitPrice === ''
        || !Number.isFinite(Number(i.unitPrice))
        || Number(i.unitPrice) < 0
        || !Number.isFinite(Number(i.quantity))
        || Number(i.quantity) <= 0
    )
    if (invalid) {
      return toast('请填写完整的项目名称和单价')
    }

    setSaving(true)
    try {
      await saveQuote(orderId, {
        items: items.map(i => ({
          type: i.type,
          name: i.name,
          quantity: Number(i.quantity),
          unitPrice: yuanToFen(i.unitPrice)
        })),
        inspection,
        discount: yuanToFen(discount)
      })
      toast.success('报价单已生成')
      clearDraft(DRAFT_KEY)
      // 有来路才返回；直接打开本页 URL（无历史）时落到工单详情，避免把用户退出站点
      if (window.history.state?.key != null) {
        router.back()
      } else {
        router.replace(`/orders/${orderId}`)
      }
    } catch { /* 已拦截 */ } finally {
      setSaving(false)
    }
  }

  // 表单变化即存草稿（400ms 防抖，项目列表一并保存，金额为页面元单位）
  useEffect(() => {
    const t = setTimeout(() => {
      // 已载入服务端数据前不存草稿，避免用空表单覆盖有意义的草稿
      if (!loaded) return
      // 无实质内容判定：没有项目、没有检测描述、优惠为 0——不落草稿
      const empty = items.length === 0 && !inspection.trim() && !(Number(discount) > 0)
      if (empty) return
      saveDraft(DRAFT_KEY, { inspection, discount, items })
    }, 400)
    return () => clearTimeout(t)
  }, [inspection, discount, items, loaded, DRAFT_KEY])

  // 首次进入：先载入服务端数据，再询问是否恢复草稿
  useEffect(() => {
    ;(async () => {
      await loadExistingQuote()
      setLoaded(true)
      // 恢复弹窗只认「真有项目」的草稿：只有描述/优惠数字的草稿价值低，
      // 弹确认框反而挡操作；顺手清掉这类垃圾草稿
      const d = loadDraft<{ inspection: string; discount: string; items: QuoteItem[] }>(DRAFT_KEY)
      if (d && (d.items?.length || 0) > 0) {
        if (await confirm({ title: '恢复草稿', message: '检测到未提交的报价内容，是否恢复？' })) {
          setInspection(d.inspection || '')
          setDiscount(d.discount || '0')
          setItems((d.items || []).map(i => ({ ...i })))
        }
      } else if (d && (d.items?.length || 0) === 0) {
        clearDraft(DRAFT_KEY)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 条目卡片渲染（工时/配件共用结构）：AnimatePresence 增删平滑进出，layout 让删除后排版收拢
  const renderItem = (item: QuoteItem, placeholder: string) => (
    <motion.div
      key={item._id}
      className="mb-2 rounded-lg p-2 px-3"
      style={{ background: 'var(--surface-2)' }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      layout
    >
      <div className="flex items-center gap-2">
        <Input
          value={item.name}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-lg border-0 font-medium focus-visible:ring-0"
          style={{ background: 'var(--surface-1)' }}
          onChange={e => updateItem(item._id, { name: e.target.value })}
        />
        {/* 删除键：按下缩小、松手带回弹地弹回（微过冲） */}
        <motion.button
          type="button"
          aria-label="删除项目"
          className="flex items-center justify-center p-1"
          style={{ color: 'var(--ink-tertiary)' }}
          whileTap={{ scale: 0.72 }}
          transition={{ type: 'spring', bounce: 0.45, duration: 0.35 }}
          onClick={() => removeItem(item._id)}
        >
          <X size={18} />
        </motion.button>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex flex-1 flex-col">
          <label className="mb-0.5 text-[11px]" style={{ color: 'var(--ink-subtle)' }}>数量</label>
          <Input
            inputMode="decimal"
            value={item.quantity}
            placeholder="1"
            className="h-8 rounded-lg border-0 text-center text-[13px] focus-visible:ring-0"
            style={{ background: 'var(--surface-1)' }}
            onChange={e => updateItem(item._id, { quantity: e.target.value })}
          />
        </div>
        <div className="flex flex-1 flex-col">
          <label className="mb-0.5 text-[11px]" style={{ color: 'var(--ink-subtle)' }}>单价</label>
          <Input
            inputMode="decimal"
            value={item.unitPrice}
            placeholder="0.00"
            className="h-8 rounded-lg border-0 text-center text-[13px] focus-visible:ring-0"
            style={{ background: 'var(--surface-1)' }}
            onChange={e => updateItem(item._id, { unitPrice: e.target.value })}
          />
        </div>
        <div className="flex w-20 flex-col text-right">
          <span className="text-muted">小计</span>
          <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--danger)' }}>
            ¥{formatAmount(item.subtotal)}
          </span>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--canvas)', paddingBottom: 'calc(150px + env(safe-area-inset-bottom))' }}>
      <NavBar title="检测报价" />

      <div className="page-content">
        {/* 故障描述 */}
        <div className="card">
          <div className="section-title">故障描述</div>
          <Textarea
            rows={3}
            value={inspection}
            placeholder="描述检测到的故障和问题"
            onChange={e => setInspection(e.target.value)}
          />
        </div>

        {/* 维修项目 */}
        <div className="card">
          <div className="flex-between mb-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>维修项目 ({items.length})</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={applyMinorMaintenance}>小保养</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={copyLastItems}>上次项目</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={() => setShowItemPicker(true)}>
                <Plus size={13} /> 常用项目
              </Button>
            </div>
          </div>

          {/* 工时项目 */}
          {serviceItems.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 pl-1 text-[13px] font-semibold" style={{ color: 'var(--ink-subtle)' }}>工时项目</div>
              <AnimatePresence initial={false}>
                {serviceItems.map(item => renderItem(item, '项目名称'))}
              </AnimatePresence>
            </div>
          )}

          {/* 配件项目 */}
          {partItems.length > 0 && (
            <div className="mb-4 last:mb-0">
              <div className="mb-2 pl-1 text-[13px] font-semibold" style={{ color: 'var(--ink-subtle)' }}>配件项目</div>
              <AnimatePresence initial={false}>
                {partItems.map(item => renderItem(item, '配件名称'))}
              </AnimatePresence>
            </div>
          )}

          {/* 空状态 */}
          {items.length === 0 && <Empty description="暂无维修项目，点击上方常用项目添加" />}

          {/* 手动添加 */}
          <div className="mt-3 flex gap-2.5">
            <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => addItem('service')}>
              <Plus size={14} /> 添加工时
            </Button>
            <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => addItem('part')}>
              <Plus size={14} /> 添加配件
            </Button>
          </div>
        </div>

        {/* 优惠 */}
        <div className="card">
          <div className="section-title">优惠</div>
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={discount}
              placeholder="0.00"
              className="h-9"
              onChange={e => setDiscount(e.target.value)}
            />
            <span className="text-muted shrink-0">元</span>
          </div>
        </div>
      </div>

      {/* 底部报价汇总：材质浮层 + 安全区 */}
      <div
        className="material-bar fixed inset-x-0 bottom-0 z-40 border-t"
        style={{ borderColor: 'var(--hairline)', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2.5">
          <div className="flex-between py-0.5 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            <span>项目合计</span>
            <span className="font-mono">¥{formatAmount(itemsTotal)}</span>
          </div>
          {Number(discount) > 0 && (
            <div className="flex-between py-0.5 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              <span>优惠</span>
              <span className="text-success font-mono">-¥{formatAmount(discount)}</span>
            </div>
          )}
          <div className="mt-1 flex-between border-t pt-1.5 text-[14px] font-semibold" style={{ borderColor: 'var(--hairline)', color: 'var(--ink)' }}>
            <span>应收金额</span>
            <span className="font-mono text-[20px] font-bold" style={{ letterSpacing: '-0.02em', color: 'var(--danger)' }}>
              ¥{formatAmount(finalAmount)}
            </span>
          </div>
        </div>
        <Button className="h-11 w-full" disabled={saving} onClick={saveQuoteHandler}>
          {saving && <Loader2 className="animate-spin" />}
          生成报价单
        </Button>
      </div>

      {/* 常用项目选择弹窗 */}
      <BottomSheet open={showItemPicker} onOpenChange={setShowItemPicker} title="常用项目">
        <ScrollTabs
          tabs={[{ label: '工时', value: 'service' }, { label: '配件', value: 'part' }]}
          value={pickerTab}
          onChange={setPickerTab}
        />
        <div className="max-h-[50vh] overflow-y-auto">
          {(pickerTab === 'service' ? PRESETS.service : PRESETS.part).map(item => (
            <Cell
              key={item.name}
              title={item.name}
              label={`参考价 ¥${item.price}`}
              onClick={() => addPresetItem(item)}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
