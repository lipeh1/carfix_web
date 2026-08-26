<template>
  <div class="quote-page">
    <van-nav-bar title="检测报价" left-text="返回" left-arrow @click-left="goBack" />

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
          <van-button size="mini" type="primary" plain icon="add" @click="showItemPicker = true">
            常用项目
          </van-button>
        </div>

        <!-- 工时项目 -->
        <div v-if="serviceItems.length > 0" class="item-group">
          <div class="group-title">工时项目</div>
          <div v-for="(item, idx) in serviceItems" :key="item._id" class="quote-item">
            <div class="item-header">
              <van-field
                v-model="item.name"
                placeholder="项目名称"
                :border="false"
                class="item-name"
              />
              <van-icon name="cross" class="item-delete" @click="removeItem(item._id)" />
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
                <van-field
                  v-model="item.unitPrice"
                  type="digit"
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
          </div>
        </div>

        <!-- 配件项目 -->
        <div v-if="partItems.length > 0" class="item-group">
          <div class="group-title">配件项目</div>
          <div v-for="(item, idx) in partItems" :key="item._id" class="quote-item">
            <div class="item-header">
              <van-field
                v-model="item.name"
                placeholder="配件名称"
                :border="false"
                class="item-name"
              />
              <van-icon name="cross" class="item-delete" @click="removeItem(item._id)" />
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
                <van-field
                  v-model="item.unitPrice"
                  type="digit"
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
          </div>
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
          type="digit"
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
    <div class="quote-footer">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getOrder, saveQuote } from '@/api'

const route = useRoute()
const router = useRouter()
const orderId = Number(route.params.id)

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

// 加载已有报价数据
const loadExistingQuote = async () => {
  try {
    const order: any = await getOrder(orderId)
    if (order.complaint) {
      inspection.value = order.complaint
    }
    if (order.repairItems && order.repairItems.length > 0) {
      items.value = order.repairItems.map((item: any) => ({
        _id: genId(),
        type: item.type,
        name: item.name,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        subtotal: item.subtotal
      }))
    }
  } catch (e) { /* 静默 */ }
}

// 保存报价
const saveQuoteHandler = async () => {
  if (items.value.length === 0) {
    return showToast('请至少添加一个维修项目')
  }
  // 校验项目名称和单价
  const invalid = items.value.find(i => !i.name || !i.unitPrice)
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
        unitPrice: Number(i.unitPrice)
      })),
      inspection: inspection.value
    })
    showToast({ type: 'success', message: '报价单已生成' })
    setTimeout(() => {
      router.back()
    }, 800)
  } catch (e) {
    // 已拦截
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.back()
}

onMounted(loadExistingQuote)
</script>

<style scoped>
.quote-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 140px;
}
.quote-content {
  padding: 12px;
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
  color: #969799;
  margin-bottom: 8px;
  padding-left: 4px;
}
.quote-item {
  background: #f7f8fa;
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
  color: #c8c9cc;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
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
  color: #969799;
  margin-bottom: 2px;
}
.item-field :deep(.van-field) {
  padding: 0;
  background: #fff;
  border-radius: 4px;
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
  font-size: 14px;
  font-weight: 600;
  color: #ee0a24;
}
.add-buttons {
  display: flex;
  gap: 10px;
}
.add-buttons .van-button {
  flex: 1;
}
/* 底部汇总 */
.quote-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
  padding: 12px;
  z-index: 100;
}
.footer-summary {
  margin-bottom: 10px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #646566;
  padding: 2px 0;
}
.summary-total {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  border-top: 1px solid #f2f3f5;
  padding-top: 6px;
  margin-top: 4px;
}
.amount-large {
  font-size: 20px;
  font-weight: 700;
  color: #ee0a24;
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
