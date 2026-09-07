<template>
  <div class="quote-page">
    <van-nav-bar title="检测报价" left-text="返回" left-arrow fixed placeholder @click-left="goBack" />

    <div class="quote-content">
      <!-- 故障描述 -->
      <div class="card">
        <div class="section-title">故障描述</div>
        <van-field
          v-model="inspection"
          type="textarea"
          rows="3"
          placeholder="描述检测到的故障和问题"
          autosize
        />
      </div>

      <!-- 维修项目 -->
      <div class="card">
        <div class="flex-between mb-12">
          <span class="section-title" style="margin-bottom:0">维修项目 ({{ items.length }})</span>
          <div class="header-btns">
            <van-button size="mini" plain type="default" @click="applyMinorMaintenance">小保养</van-button>
            <van-button size="mini" plain type="default" @click="copyLastItems">上次项目</van-button>
            <van-button size="mini" type="primary" plain icon="add" @click="showItemPicker = true">
              常用项目
            </van-button>
          </div>
        </div>

        <!-- 工时项目：AnimatePresence 让增删项目时平滑进出，layout 让删除后排版平滑收拢（进出/重排均走临界阻尼弹簧） -->
        <div v-if="serviceItems.length > 0" class="item-group">
          <div class="group-title">工时项目</div>
          <AnimatePresence>
            <motion.div
              v-for="item in serviceItems"
              :key="item._id"
              class="quote-item"
              :initial="{ opacity: 0, y: -8 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, transition: { duration: 0.15 } }"
              :transition="{ type: 'spring', bounce: 0, duration: 0.3 }"
              layout
            >
              <div class="item-header">
                <van-field
                  v-model="item.name"
                  placeholder="项目名称"
                  :border="false"
                  class="item-name"
                />
                <!-- 删除键：按下缩小、松手带回弹地弹回（微过冲） -->
                <motion.span
                  class="item-delete"
                  :while-press="{ scale: 0.72 }"
                  :transition="{ type: 'spring', bounce: 0.45, duration: 0.35 }"
                  @click="removeItem(item._id)"
                >
                  <van-icon name="cross" />
                </motion.span>
              </div>
              <div class="item-row">
                <div class="item-field">
                  <label>数量</label>
                  <van-field
                    v-model="item.quantity"
                    type="digit"
                    placeholder="1"
                    :border="false"
                    @update:model-value="calcSubtotal(item)"
                  />
                </div>
                <div class="item-field">
                  <label>单价</label>
                  <!-- 单价允许小数，用 number 键盘而非 digit 整数键盘 -->
                  <van-field
                    v-model="item.unitPrice"
                    type="number"
                    placeholder="0.00"
                    :border="false"
                    @update:model-value="calcSubtotal(item)"
                  />
                </div>
                <div class="item-subtotal">
                  <span class="text-muted">小计</span>
                  <span class="amount">¥{{ formatAmount(item.subtotal) }}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <!-- 配件项目：同上 -->
        <div v-if="partItems.length > 0" class="item-group">
          <div class="group-title">配件项目</div>
          <AnimatePresence>
            <motion.div
              v-for="item in partItems"
              :key="item._id"
              class="quote-item"
              :initial="{ opacity: 0, y: -8 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, transition: { duration: 0.15 } }"
              :transition="{ type: 'spring', bounce: 0, duration: 0.3 }"
              layout
            >
              <div class="item-header">
                <van-field
                  v-model="item.name"
                  placeholder="配件名称"
                  :border="false"
                  class="item-name"
                />
                <!-- 删除键：按下缩小、松手带回弹地弹回（微过冲） -->
                <motion.span
                  class="item-delete"
                  :while-press="{ scale: 0.72 }"
                  :transition="{ type: 'spring', bounce: 0.45, duration: 0.35 }"
                  @click="removeItem(item._id)"
                >
                  <van-icon name="cross" />
                </motion.span>
              </div>
              <div class="item-row">
                <div class="item-field">
                  <label>数量</label>
                  <van-field
                    v-model="item.quantity"
                    type="digit"
                    placeholder="1"
                    :border="false"
                    @update:model-value="calcSubtotal(item)"
                  />
                </div>
                <div class="item-field">
                  <label>单价</label>
                  <!-- 单价允许小数，用 number 键盘而非 digit 整数键盘 -->
                  <van-field
                    v-model="item.unitPrice"
                    type="number"
                    placeholder="0.00"
                    :border="false"
                    @update:model-value="calcSubtotal(item)"
                  />
                </div>
                <div class="item-subtotal">
                  <span class="text-muted">小计</span>
                  <span class="amount">¥{{ formatAmount(item.subtotal) }}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <!-- 空状态 -->
        <van-empty v-if="items.length === 0" description="暂无维修项目，点击上方常用项目添加" image-size="60" />

        <!-- 手动添加 -->
        <div class="add-buttons mt-12">
          <van-button size="small" plain type="default" icon="add" @click="addItem('service')">
            添加工时
          </van-button>
          <van-button size="small" plain type="default" icon="add" @click="addItem('part')">
            添加配件
          </van-button>
        </div>
      </div>

      <!-- 优惠 -->
      <div class="card">
        <div class="section-title">优惠</div>
        <van-field
          v-model="discount"
          type="number"
          label="优惠金额"
          placeholder="0.00"
        >
          <template #button>
            <span class="text-muted">元</span>
          </template>
        </van-field>
      </div>
    </div>

    <!-- 底部报价汇总 -->
    <div class="quote-footer material-bar">
      <div class="footer-summary">
        <div class="summary-row">
          <span>项目合计</span>
          <span>¥{{ formatAmount(itemsTotal) }}</span>
        </div>
        <div class="summary-row" v-if="Number(discount) > 0">
          <span>优惠</span>
          <span class="text-success">-¥{{ formatAmount(discount) }}</span>
        </div>
        <div class="summary-row summary-total">
          <span>应收金额</span>
          <span class="amount-large">¥{{ formatAmount(finalAmount) }}</span>
        </div>
      </div>
      <van-button type="primary" block class="save-btn" :loading="saving" @click="saveQuoteHandler">
        生成报价单
      </van-button>
    </div>

    <!-- 常用项目选择弹窗 -->
    <van-popup v-model:show="showItemPicker" position="bottom" round>
      <div class="picker-content">
        <div class="picker-header">
          <h3>常用项目</h3>
          <van-tabs v-model:active="pickerTab" sticky>
            <van-tab title="工时" name="service" />
            <van-tab title="配件" name="part" />
          </van-tabs>
        </div>
        <div class="picker-list">
          <van-cell
            v-for="item in currentPresetItems"
            :key="item.name"
            :title="item.name"
            :label="`参考价 ¥${item.price}`"
            is-link
            @click="addPresetItem(item)"
          />
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { motion, AnimatePresence } from 'motion-v'
import { getOrder, saveQuote, getLastQuote } from '@/api'
import { fenToYuan, yuanToFen } from '@/utils/money'
import { saveDraft, loadDraft, clearDraft, draftHasContent } from '@/utils/draft'

const route = useRoute()
const router = useRouter()
const orderId = Number(route.params.id)

// 报价表单草稿键（按工单隔离）
const DRAFT_KEY = 'quote:' + orderId

const inspection = ref('')
const discount = ref('0')
const saving = ref(false)
const showItemPicker = ref(false)
const pickerTab = ref('service')

// 维修项目列表
const items = ref<Array<{
  _id: string
  type: 'service' | 'part'
  name: string
  quantity: string
  unitPrice: string
  subtotal: number
}>>([])

// 常用项目预设
const presetItems = {
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

const currentPresetItems = computed(() =>
  pickerTab.value === 'service' ? presetItems.service : presetItems.part
)

// 按类型分组
const serviceItems = computed(() => items.value.filter(i => i.type === 'service'))
const partItems = computed(() => items.value.filter(i => i.type === 'part'))

// 项目合计
const itemsTotal = computed(() =>
  items.value.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0)
)

// 最终金额
const finalAmount = computed(() => {
  const total = itemsTotal.value - (Number(discount.value) || 0)
  return Math.max(0, total)
})

// 本页 item.unitPrice/subtotal 等均为输入用的"元"（提交/载入时才与后端的"分"换算）
const formatAmount = (n: number | string) => Number(n || 0).toFixed(2)

// 生成唯一ID
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// 计算小计
const calcSubtotal = (item: any) => {
  item.subtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
}

// 添加项目
const addItem = (type: 'service' | 'part') => {
  items.value.push({
    _id: genId(),
    type,
    name: '',
    quantity: '1',
    unitPrice: '',
    subtotal: 0
  })
}

// 添加预设项目
const addPresetItem = (preset: { name: string; price: number }) => {
  const type = pickerTab.value as 'service' | 'part'
  // 检查是否已存在同名项目
  const existing = items.value.find(i => i.name === preset.name && i.type === type)
  if (existing) {
    existing.quantity = String(Number(existing.quantity) + 1)
    calcSubtotal(existing)
    showToast('已添加到现有项目')
  } else {
    items.value.push({
      _id: genId(),
      type,
      name: preset.name,
      quantity: '1',
      unitPrice: String(preset.price),
      subtotal: preset.price
    })
  }
  showItemPicker.value = false
}

// 删除项目
const removeItem = (id: string) => {
  const idx = items.value.findIndex(i => i._id === id)
  if (idx > -1) items.value.splice(idx, 1)
}

// 复制这辆车上次已完成工单的报价项目（金额接口返回分，转为元）
const copyLastItems = async () => {
  try {
    const data: any = await getLastQuote(orderId)
    if (!data.order || !data.items || data.items.length === 0) {
      return showToast('这辆车还没有已完成的历史工单')
    }
    for (const it of data.items) {
      const existing = items.value.find(i => i.name === it.name && i.type === it.type)
      if (existing) {
        existing.quantity = String(Number(existing.quantity) + it.quantity)
        calcSubtotal(existing)
      } else {
        items.value.push({
          _id: genId(),
          type: it.type,
          name: it.name,
          quantity: String(it.quantity),
          unitPrice: fenToYuan(it.unitPrice),
          subtotal: it.subtotal / 100
        })
      }
    }
    showToast({ type: 'success', message: `已带入 ${data.order.orderNo} 的 ${data.items.length} 项` })
  } catch (e) { /* 已拦截 */ }
}

// 小保养一键模板：最高频场景，生成后可改数量单价
const minorMaintenanceTemplate = [
  { type: 'part', name: '机油（4L）', price: 280 },
  { type: 'part', name: '机油滤芯', price: 35 },
  { type: 'service', name: '机油更换工时', price: 50 }
]
const applyMinorMaintenance = () => {
  for (const t of minorMaintenanceTemplate) {
    const existing = items.value.find(i => i.name === t.name && i.type === t.type)
    if (existing) {
      existing.quantity = String(Number(existing.quantity) + 1)
      calcSubtotal(existing)
    } else {
      items.value.push({
        _id: genId(),
        type: t.type as 'service' | 'part',
        name: t.name,
        quantity: '1',
        unitPrice: String(t.price),
        subtotal: t.price
      })
    }
  }
  showToast({ type: 'success', message: '已生成小保养项目，可调整数量价格' })
}

// 加载已有报价数据
const loadExistingQuote = async () => {
  try {
    const order: any = await getOrder(orderId)
    // 检测结果用独立的 inspection 字段回填（与客户诉求 complaint 是两回事）
    inspection.value = order.inspection || ''
    // 回显报价时登记的优惠（接口返回分，输入为元）
    discount.value = fenToYuan(order.discount)
    if (order.repairItems && order.repairItems.length > 0) {
      // 只载入报价来源的项目：增项有独立的确认流程，
      // 若混入编辑列表，再次保存报价会重建出重复项目，造成双重计费
      const quoteItems = order.repairItems.filter((i: any) => i.source === 'quote')
      items.value = quoteItems.map((item: any) => ({
        _id: genId(),
        type: item.type,
        name: item.name,
        quantity: String(item.quantity),
        unitPrice: fenToYuan(item.unitPrice),
        subtotal: item.subtotal / 100
      }))
    }
  } catch (e) { /* 静默 */ }
}

// 保存报价
const saveQuoteHandler = async () => {
  if (items.value.length === 0) {
    return showToast('请至少添加一个维修项目')
  }
  // 校验项目名称必填；数量为正数；单价允许小数且不能为负
  const invalid = items.value.find(
    i => !i.name
      || i.unitPrice === ''
      || !Number.isFinite(Number(i.unitPrice))
      || Number(i.unitPrice) < 0
      || !Number.isFinite(Number(i.quantity))
      || Number(i.quantity) <= 0
  )
  if (invalid) {
    return showToast('请填写完整的项目名称和单价')
  }

  saving.value = true
  try {
    await saveQuote(orderId, {
      items: items.value.map(i => ({
        type: i.type,
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: yuanToFen(i.unitPrice)
      })),
      inspection: inspection.value,
      discount: yuanToFen(discount.value)
    })
    showToast({ type: 'success', message: '报价单已生成' })
    clearDraft(DRAFT_KEY)
    // 有来路才返回;直接打开本页 URL(无历史)时落到工单详情,避免把用户退出站点
    if (window.history.state?.back != null) {
      router.back()
    } else {
      router.replace(`/orders/${orderId}`)
    }
  } catch (e) {
    // 已拦截
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.back()
}

// 表单变化即存草稿（项目列表一并保存，金额为页面元单位）
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch([inspection, discount, items], () => {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    // 已载入服务端数据前不存草稿，避免用空表单覆盖有意义的草稿
    if (!loaded.value) return
    saveDraft(DRAFT_KEY, { inspection: inspection.value, discount: discount.value, items: items.value })
  }, 400)
}, { deep: true })

// 服务端数据是否已载入完成（之后再开始记录草稿）
const loaded = ref(false)

onMounted(async () => {
  await loadExistingQuote()
  loaded.value = true
  // 已有报价内容时不弹草稿（服务端数据优先）；空表单时询问恢复
  const d = loadDraft<{ inspection: string; discount: string; items: any[] }>(DRAFT_KEY)
  if (d && draftHasContent(d) && items.value.length === 0) {
    try {
      const { showConfirmDialog } = await import('vant')
      await showConfirmDialog({ title: '恢复草稿', message: '检测到未提交的报价内容，是否恢复？' })
      inspection.value = d.inspection || ''
      discount.value = d.discount || '0'
      items.value = (d.items || []).map((i: any) => ({ ...i }))
    } catch (e) { /* 放弃恢复 */ }
  }
})
</script>

<style scoped>
.quote-page {
  min-height: 100vh;
  background: var(--canvas);
  /* 盖住固定底部汇总栏 + 底部安全区 */
  padding-bottom: calc(150px + env(safe-area-inset-bottom));
}
.quote-content {
  padding: 12px;
}
/* 头部快捷按钮组 */
.header-btns {
  display: flex;
  gap: 6px;
}
.item-group {
  margin-bottom: 16px;
}
.item-group:last-child {
  margin-bottom: 0;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-subtle);
  margin-bottom: 8px;
  padding-left: 4px;
}
/* 报价项目：表面2浮层 */
.quote-item {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-name {
  flex: 1;
}
.item-name :deep(.van-field__control) {
  font-weight: 500;
}
.item-delete {
  color: var(--ink-tertiary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  /* motion.span 需要行内弹性布局让图标居中 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
.item-field {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.item-field label {
  font-size: 11px;
  color: var(--ink-subtle);
  margin-bottom: 2px;
}
/* 嵌套输入框：表面1 + 发丝线，与外层表面2区分 */
.item-field :deep(.van-field) {
  background: var(--surface-1);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  padding: 4px 8px;
}
.item-field :deep(.van-field__control) {
  font-size: 13px;
  text-align: center;
}
.item-subtotal {
  width: 80px;
  text-align: right;
  display: flex;
  flex-direction: column;
}
.item-subtotal .amount {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--danger);
}
.add-buttons {
  display: flex;
  gap: 10px;
}
.add-buttons .van-button {
  flex: 1;
}
/* 底部汇总：材质浮层（半透明毛玻璃见 global.css .material-bar）+ 发丝线上边框 */
.quote-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  /* 底部预留全面屏 Home 指示条安全区 */
  padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--hairline);
  z-index: 100;
}
.footer-summary {
  margin-bottom: 10px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ink-muted);
  padding: 2px 0;
}
.summary-total {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  border-top: 1px solid var(--hairline);
  padding-top: 6px;
  margin-top: 4px;
}
.amount-large {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  /* 大号数字收紧字距（AGENTS.md：20px 档 -0.4px） */
  letter-spacing: -0.02em;
  color: var(--danger);
}
.save-btn {
  height: 44px;
}
/* 常用项目弹窗 */
.picker-content {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}
.picker-header h3 {
  text-align: center;
  padding: 16px 0 8px;
  margin: 0;
}
.picker-list {
  flex: 1;
  overflow-y: auto;
  max-height: 50vh;
}
</style>
