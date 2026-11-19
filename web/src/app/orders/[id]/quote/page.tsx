'use client'

// 检测报价编辑器：工时/配件两组条目 + 常用预设/小保养模板/复制上次 + 草稿（自旧 Quote.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X, Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import BottomSheet from '@/components/mobile/BottomSheet'
import ScrollTabs from '@/components/mobile/ScrollTabs'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { getOrder, saveQuote, getLastQuote } from '@/lib/api'
import type { WorkOrder } from '@/lib/types'
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
  const reduceMotion = useReducedMotion()
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
  const [identity, setIdentity] = useState<Pick<WorkOrder, 'orderNo' | 'vehicle'> | null>(null)

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
      setIdentity({ orderNo: order.orderNo, vehicle: order.vehicle })
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

  // 仅项目增删提供短反馈；既有内容不重复进场，减弱动态时立即更新
  const renderItem = (item: QuoteItem, placeholder: string) => (
    <motion.div
      key={item._id}
      className="quote-item"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
      layout={reduceMotion ? false : 'position'}
    >
      <div className="quote-item-name">
        <Input
          value={item.name}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={e => updateItem(item._id, { name: e.target.value })}
        />
        {/* 删除按钮保持完整触控面积，按压不使用过冲弹跳 */}
        <motion.button
          type="button"
          aria-label="删除项目"
          className="quote-item-remove"
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          onClick={() => removeItem(item._id)}
        >
          <X size={18} />
        </motion.button>
      </div>
      <div className="quote-item-values">
        <div className="quote-item-field">
          <label htmlFor={item._id + '-quantity'}>数量</label>
          <Input
            id={item._id + '-quantity'}
            inputMode="decimal"
            value={item.quantity}
            placeholder="1"
            onChange={e => updateItem(item._id, { quantity: e.target.value })}
          />
        </div>
        <div className="quote-item-field">
          <label htmlFor={item._id + '-price'}>单价</label>
          <Input
            id={item._id + '-price'}
            inputMode="decimal"
            value={item.unitPrice}
            placeholder="0.00"
            onChange={e => updateItem(item._id, { unitPrice: e.target.value })}
          />
        </div>
        <div className="quote-item-subtotal">
          <span>小计</span>
          <span>
            ¥{formatAmount(item.subtotal)}
          </span>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="quote-page">
      <NavBar title="检测报价" />

      <div className="quote-layout">
        <div className="quote-main">
          {identity && (
            <header className="quote-identity">
              <strong className="order-plate">{identity.vehicle?.plateNumber || identity.orderNo}</strong>
              <div className="identity-meta">
                {(identity.vehicle?.brand || identity.vehicle?.model) && <span>{identity.vehicle.brand} {identity.vehicle.model}</span>}
                {identity.vehicle?.plateNumber && <span className="font-mono">{identity.orderNo}</span>}
              </div>
            </header>
          )}
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
          <div className="card quote-projects">
            <div className="quote-projects-header">
              <h2 className="section-title">维修项目{items.length > 0 && <small>{items.length} 项</small>}</h2>
              <div className="quote-presets">
                <Button variant="link" size="sm" onClick={applyMinorMaintenance}>小保养</Button>
                <Button variant="link" size="sm" onClick={copyLastItems}>上次项目</Button>
                {items.length > 0 && <Button variant="link" size="sm" onClick={() => setShowItemPicker(true)}>
                  <Plus size={13} /> 常用项目
                </Button>}
              </div>
            </div>

            {/* 工时项目 */}
            {serviceItems.length > 0 && (
              <div className="mb-4">
                <div className="quote-group-title">工时项目</div>
                <AnimatePresence initial={false}>
                  {serviceItems.map(item => renderItem(item, '项目名称'))}
                </AnimatePresence>
              </div>
            )}

            {/* 配件项目 */}
            {partItems.length > 0 && (
              <div className="mb-4 last:mb-0">
                <div className="quote-group-title">配件项目</div>
                <AnimatePresence initial={false}>
                  {partItems.map(item => renderItem(item, '配件名称'))}
                </AnimatePresence>
              </div>
            )}

            {/* 空状态 */}
            {items.length === 0 && <div className="quote-empty-line">
              <span>尚未添加维修项目</span>
              <button type="button" className="inline-action" onClick={() => setShowItemPicker(true)}><Plus size={15} />常用项目</button>
            </div>}

            {/* 手动添加 */}
            <div className="quote-add-actions">
              <Button variant="link" size="sm" onClick={() => addItem('service')}>
                <Plus size={14} /> 添加工时
              </Button>
              <Button variant="link" size="sm" onClick={() => addItem('part')}>
                <Plus size={14} /> 添加配件
              </Button>
            </div>
          </div>

          {/* 优惠 */}
          <div className="card quote-discount">
            <label className="section-title" htmlFor="quote-discount">优惠</label>
            <div className="flex items-center gap-2">
              <Input
                id="quote-discount"
                inputMode="decimal"
                value={discount}
                placeholder="0.00"
                className="h-10 font-mono"
                onChange={e => setDiscount(e.target.value)}
              />
              <span className="text-muted shrink-0">元</span>
            </div>
          </div>
        </div>

        {/* 汇总在桌面跟随右侧阅读，在手机固定底部方便提交 */}
        <aside className="quote-summary">
          {(items.length > 0 || Number(discount) > 0) && <div className="quote-summary-lines">
            <span>项目合计 <b>¥{formatAmount(itemsTotal)}</b></span>
            {Number(discount) > 0 && (
              <span>优惠 <b>-¥{formatAmount(discount)}</b></span>
            )}
          </div>}
          <div className="quote-summary-total">
            <span>应收金额</span>
            <span>¥{formatAmount(finalAmount)}</span>
          </div>
          <Button className="h-11 w-full" disabled={saving} onClick={saveQuoteHandler}>
            {saving && <Loader2 className="animate-spin" />}
            生成报价单
          </Button>
        </aside>
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
              right={<span className="font-mono">参考价 ¥{formatAmount(item.price)}</span>}
              onClick={() => addPresetItem(item)}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
