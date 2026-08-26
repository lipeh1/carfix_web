<template>
  <div class="page-container">
    <van-nav-bar :title="`工单 #${order?.orderNo || ''}`" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content" v-if="order">
      <!-- 状态卡片 -->
      <div class="card status-card">
        <div class="flex-between">
          <div>
            <div class="plate">{{ order.vehicle?.plateNumber }}</div>
            <div class="text-muted mt-8">{{ order.customer?.name }} · {{ order.customer?.phone }}</div>
          </div>
          <van-tag :type="getStatusType(order.status)" size="medium">
            {{ getStatusLabel(order.status) }}
          </van-tag>
        </div>
      </div>

      <!-- 接车信息 -->
      <div class="card">
        <div class="flex-between">
          <span class="section-title">接车信息</span>
          <van-button size="mini" plain type="primary" icon="edit" @click="openEditCheckin">
            编辑
          </van-button>
        </div>
        <van-cell title="客户诉求" :value="order.complaint || '-'" />
        <van-cell title="接车里程" :value="order.mileageIn ? order.mileageIn + ' km' : '-'" />
        <van-cell title="车况描述" :value="order.checkinRecord?.vehicleCondition || '-'" />
        <van-cell title="创建时间" :value="formatDateTime(order.createdAt)" />
      </div>

      <!-- 接车照片 -->
      <div class="card" v-if="checkinPhotos.length > 0">
        <div class="section-title">接车照片</div>
        <van-image-preview v-model:show="showPreview" :images="previewImages" />
        <div class="photo-grid">
          <img
            v-for="(photo, idx) in checkinPhotos"
            :key="photo.id"
            :src="photo.filePath"
            class="photo-item"
            @click="openPreview(idx)"
          />
        </div>
      </div>

      <!-- 维修项目 -->
      <div class="card" v-if="repairItems.length > 0">
        <div class="section-title">维修项目 / 配件</div>
        <van-cell
          v-for="item in repairItems"
          :key="item.id"
          :title="item.name"
          :label="`${item.type === 'service' ? '工时' : '配件'} × ${item.quantity}`"
        >
          <template #value>¥{{ Number(item.subtotal).toFixed(2) }}</template>
        </van-cell>
        <div class="flex-between mt-12">
          <span>合计</span>
          <span class="amount">¥{{ itemsTotal.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 维修记录 -->
      <div class="card" v-if="repairLogs.length > 0">
        <div class="section-title">维修记录</div>
        <div v-for="log in repairLogs" :key="log.id" class="log-item">
          <div class="log-content">{{ log.content }}</div>
          <div class="text-muted">{{ formatDateTime(log.createdAt) }}</div>
        </div>
      </div>

      <!-- 增项 -->
      <div class="card" v-if="additionalItems.length > 0">
        <div class="section-title">维修增项</div>
        <div v-for="item in additionalItems" :key="item.id" class="additional-item">
          <van-cell :title="item.name" :label="item.reason">
            <template #value>
              <div style="text-align:right">
                <div>¥{{ Number(item.amount).toFixed(2) }}</div>
                <van-tag :type="item.status === 'confirmed' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'">
                  {{ item.status === 'confirmed' ? '已确认' : item.status === 'rejected' ? '已拒绝' : '待确认' }}
                </van-tag>
              </div>
            </template>
          </van-cell>
          <!-- 待确认增项的操作按钮 -->
          <div v-if="item.status === 'pending'" class="additional-actions">
            <van-button size="small" type="success" @click="handleConfirmAdditional(item, true)">确认</van-button>
            <van-button size="small" type="danger" plain @click="handleConfirmAdditional(item, false)">拒绝</van-button>
          </div>
        </div>
      </div>

      <!-- 结算信息 -->
      <div class="card" v-if="settlement">
        <div class="section-title">结算信息</div>
        <van-cell title="结算单号" :value="settlement.settlementNo" />
        <van-cell title="应收金额" :value="`¥${Number(settlement.totalAmount).toFixed(2)}`" />
        <van-cell title="优惠" :value="`¥${Number(settlement.discount || 0).toFixed(2)}`" />
        <van-cell title="实收金额" :value="`¥${Number(settlement.actualAmount).toFixed(2)}`" />
        <van-cell title="已收金额" :value="`¥${Number(settlement.paidAmount).toFixed(2)}`" />
        <van-cell title="状态">
          <template #value>
            <van-tag :type="settlement.status === 'paid' ? 'success' : 'warning'">
              {{ settlement.status === 'paid' ? '已结清' : '挂账' }}
            </van-tag>
          </template>
        </van-cell>
        <!-- 收款记录 -->
        <div v-if="settlement.payments?.length > 0" class="mt-12">
          <div class="text-muted mb-8">收款记录</div>
          <div v-for="p in settlement.payments" :key="p.id" class="payment-item">
            <span>{{ formatDateTime(p.createdAt) }} · {{ methodLabel(p.method) }}</span>
            <span class="text-success">+¥{{ Number(p.amount).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="action-bar" v-if="actionButtons.length > 0">
        <van-button
          v-for="btn in actionButtons"
          :key="btn.key"
          :type="btn.type"
          block
          @click="handleAction(btn.key)"
        >
          {{ btn.label }}
        </van-button>
      </div>
    </div>

    <van-empty v-else description="加载中..." />

    <!-- ===== 编辑接车信息弹窗 ===== -->
    <van-popup v-model:show="showEditCheckin" position="bottom" round>
      <div class="popup-content">
        <h3>编辑接车信息</h3>
        <van-field
          v-model="editCheckinForm.complaint"
          label="客户诉求"
          type="textarea"
          rows="2"
          placeholder="描述故障或需求"
        />
        <van-field
          v-model="editCheckinForm.mileageIn"
          label="接车里程"
          type="digit"
          placeholder="公里数"
        />
        <van-field
          v-model="editCheckinForm.vehicleCondition"
          label="车况描述"
          type="textarea"
          rows="2"
          placeholder="可选"
        />
        <van-button type="primary" block class="mt-16" :loading="savingCheckin" @click="submitEditCheckin">
          保存
        </van-button>
      </div>
    </van-popup>

    <!-- ===== 维修记录弹窗 ===== -->
    <van-popup v-model:show="showLogPopup" position="bottom" round>
      <div class="popup-content">
        <h3>记录维修</h3>
        <van-field v-model="logContent" label="维修内容" type="textarea" rows="3" placeholder="描述维修过程和操作" />
        <van-button type="primary" block class="mt-16" @click="submitLog">保存</van-button>
      </div>
    </van-popup>

    <!-- ===== 增项弹窗 ===== -->
    <van-popup v-model:show="showAdditionalPopup" position="bottom" round>
      <div class="popup-content">
        <h3>新增增项</h3>
        <van-field v-model="additionalForm.name" label="项目名称" placeholder="如更换刹车片" />
        <van-field v-model="additionalForm.amount" label="费用" type="digit" placeholder="元" />
        <van-field v-model="additionalForm.reason" label="原因" type="textarea" rows="2" placeholder="说明新增原因" />
        <van-button type="primary" block class="mt-16" @click="submitAdditional">提交增项</van-button>
      </div>
    </van-popup>

    <!-- ===== 收款弹窗 ===== -->
    <van-popup v-model:show="showPaymentPopup" position="bottom" round>
      <div class="popup-content">
        <h3>收款</h3>
        <div class="payment-info" v-if="settlement">
          <div class="flex-between">
            <span>应收金额</span>
            <span>¥{{ Number(settlement.actualAmount).toFixed(2) }}</span>
          </div>
          <div class="flex-between mt-8">
            <span>已收金额</span>
            <span>¥{{ Number(settlement.paidAmount).toFixed(2) }}</span>
          </div>
          <div class="flex-between mt-8">
            <span class="text-danger">待收金额</span>
            <span class="text-danger">¥{{ unpaidAmount.toFixed(2) }}</span>
          </div>
        </div>
        <van-field v-model="paymentForm.amount" label="收款金额" type="digit" placeholder="元" class="mt-12" />
        <van-field name="method" label="收款方式">
          <template #input>
            <van-radio-group v-model="paymentForm.method" direction="horizontal">
              <van-radio name="cash">现金</van-radio>
              <van-radio name="wechat">微信</van-radio>
              <van-radio name="alipay">支付宝</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-button type="primary" block class="mt-16" @click="submitPayment">确认收款</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  getOrder, updateOrderStatus, addRepairLog,
  addAdditionalItem, confirmAdditionalItem, createQualityCheck,
  createSettlement, addPayment, deliverOrder, updateCheckin
} from '@/api'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const orderId = Number(route.params.id)

// 工单数据
const order = ref<any>(null)
const checkinPhotos = ref<any[]>([])
const repairItems = ref<any[]>([])
const repairLogs = ref<any[]>([])
const additionalItems = ref<any[]>([])
const settlement = ref<any>(null)
const showPreview = ref(false)
const previewImages = ref<string[]>([])

// 弹窗状态
const showEditCheckin = ref(false)
const showLogPopup = ref(false)
const showAdditionalPopup = ref(false)
const showPaymentPopup = ref(false)

// 编辑接车信息表单
const savingCheckin = ref(false)
const editCheckinForm = reactive({ complaint: '', mileageIn: '', vehicleCondition: '' })

// 维修记录
const logContent = ref('')

// 增项表单
const additionalForm = reactive({ name: '', amount: '', reason: '' })

// 收款表单
const paymentForm = reactive({ amount: '', method: 'cash' })

// 状态映射
const statusMap: Record<string, { label: string; type: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  pending_inspection: { label: '待检测', type: 'warning' },
  pending_quote: { label: '待报价确认', type: 'primary' },
  repairing: { label: '维修中', type: 'danger' },
  pending_quality_check: { label: '待质检', type: 'warning' },
  pending_settlement: { label: '待结算', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'default' }
}

const getStatusLabel = (s: string) => statusMap[s]?.label || s
const getStatusType = (s: string) => statusMap[s]?.type || 'default'
const formatDateTime = (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm')
const methodLabel = (m: string) => ({ cash: '现金', wechat: '微信', alipay: '支付宝', card: '刷卡', transfer: '转账' } as any)[m] || m

// 维修项目合计
const itemsTotal = computed(() =>
  repairItems.value.reduce((sum, i) => sum + Number(i.subtotal), 0)
)

// 待收金额
const unpaidAmount = computed(() => {
  if (!settlement.value) return 0
  return Number(settlement.value.actualAmount) - Number(settlement.value.paidAmount)
})

// 底部操作按钮（根据当前状态动态显示）
const actionButtons = computed(() => {
  const s = order.value?.status
  const btns: any[] = []
  if (s === 'pending_inspection') {
    btns.push({ key: 'go_quote', label: '去检测报价', type: 'primary' })
  }
  if (s === 'pending_quote') {
    btns.push({ key: 'confirm_quote', label: '客户确认报价', type: 'primary' })
    btns.push({ key: 'cancel', label: '取消维修', type: 'danger' })
  }
  if (s === 'repairing') {
    btns.push({ key: 'add_log', label: '记录维修', type: 'default' })
    btns.push({ key: 'add_item', label: '新增增项', type: 'default' })
    btns.push({ key: 'finish_repair', label: '维修完成', type: 'primary' })
  }
  if (s === 'pending_quality_check') {
    btns.push({ key: 'qc_pass', label: '质检通过', type: 'success' })
    btns.push({ key: 'qc_fail', label: '质检不通过', type: 'danger' })
  }
  if (s === 'pending_settlement') {
    btns.push({ key: 'receive_payment', label: '收款', type: 'primary' })
    btns.push({ key: 'deliver', label: '交车', type: 'success' })
  }
  return btns
})

// 加载工单详情
const loadData = async () => {
  try {
    const data: any = await getOrder(orderId)
    order.value = data
    checkinPhotos.value = data.checkinPhotos || []
    repairItems.value = data.repairItems || []
    repairLogs.value = data.repairLogs || []
    additionalItems.value = data.additionalItems || []
    settlement.value = data.settlement || null
  } catch (e) { /* 静默 */ }
}

// 图片预览
const openPreview = (idx: number) => {
  previewImages.value = checkinPhotos.value.map((p: any) => p.filePath)
  showPreview.value = true
}

// ===== 编辑接车信息 =====
const openEditCheckin = () => {
  if (!order.value) return
  editCheckinForm.complaint = order.value.complaint || ''
  editCheckinForm.mileageIn = order.value.mileageIn ? String(order.value.mileageIn) : ''
  editCheckinForm.vehicleCondition = order.value.checkinRecord?.vehicleCondition || ''
  showEditCheckin.value = true
}

const submitEditCheckin = async () => {
  if (!editCheckinForm.complaint) return showToast('客户诉求不能为空')
  savingCheckin.value = true
  try {
    await updateCheckin(orderId, {
      complaint: editCheckinForm.complaint,
      mileageIn: editCheckinForm.mileageIn,
      vehicleCondition: editCheckinForm.vehicleCondition
    })
    showToast({ type: 'success', message: '保存成功' })
    showEditCheckin.value = false
    loadData()
  } catch (e) { /* 已拦截 */ }
  finally {
    savingCheckin.value = false
  }
}

// ===== 维修记录 =====
const submitLog = async () => {
  if (!logContent.value) return showToast('请输入维修内容')
  try {
    await addRepairLog(orderId, logContent.value)
    showToast({ type: 'success', message: '已记录' })
    showLogPopup.value = false
    logContent.value = ''
    loadData()
  } catch (e) { /* 已拦截 */ }
}

// ===== 增项 =====
const submitAdditional = async () => {
  if (!additionalForm.name) return showToast('请输入项目名称')
  if (!additionalForm.amount) return showToast('请输入费用')
  try {
    await addAdditionalItem(orderId, {
      name: additionalForm.name,
      amount: Number(additionalForm.amount),
      reason: additionalForm.reason
    })
    showToast({ type: 'success', message: '增项已提交，待客户确认' })
    showAdditionalPopup.value = false
    additionalForm.name = ''
    additionalForm.amount = ''
    additionalForm.reason = ''
    loadData()
  } catch (e) { /* 已拦截 */ }
}

// 确认或拒绝增项
const handleConfirmAdditional = async (item: any, confirmed: boolean) => {
  try {
    if (confirmed) {
      await showConfirmDialog({
        title: '确认增项',
        message: `确认添加「${item.name}」（¥${Number(item.amount).toFixed(2)}）？确认后将计入维修项目和结算金额。`
      })
    } else {
      await showConfirmDialog({
        title: '拒绝增项',
        message: `确定拒绝「${item.name}」？`
      })
    }
    await confirmAdditionalItem(item.id, confirmed)
    showToast({ type: 'success', message: confirmed ? '增项已确认' : '增项已拒绝' })
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') { /* 已拦截 */ }
  }
}

// ===== 收款 =====
const submitPayment = async () => {
  if (!paymentForm.amount) return showToast('请输入收款金额')
  if (!settlement.value) {
    // 先创建结算单
    await createSettlement(orderId)
    await loadData()
  }
  try {
    await addPayment(settlement.value.id, {
      amount: Number(paymentForm.amount),
      method: paymentForm.method,
      type: settlement.value.paidAmount > 0 ? 'supplement' : 'initial'
    })
    showToast({ type: 'success', message: '收款成功' })
    showPaymentPopup.value = false
    paymentForm.amount = ''
    loadData()
  } catch (e) { /* 已拦截 */ }
}

// ===== 操作按钮处理 =====
const handleAction = async (key: string) => {
  try {
    switch (key) {
      case 'go_quote':
        // 跳转到独立的检测报价页面
        router.push(`/orders/${orderId}/quote`)
        break
      case 'confirm_quote':
        await updateOrderStatus(orderId, 'repairing')
        showToast({ type: 'success', message: '已确认，开始维修' })
        loadData()
        break
      case 'cancel':
        await showConfirmDialog({ title: '确认取消', message: '确定取消该工单？' })
        await updateOrderStatus(orderId, 'cancelled')
        showToast('已取消')
        loadData()
        break
      case 'add_log':
        logContent.value = ''
        showLogPopup.value = true
        break
      case 'add_item':
        additionalForm.name = ''
        additionalForm.amount = ''
        additionalForm.reason = ''
        showAdditionalPopup.value = true
        break
      case 'finish_repair':
        await updateOrderStatus(orderId, 'pending_quality_check')
        showToast({ type: 'success', message: '维修完成，待质检' })
        loadData()
        break
      case 'qc_pass':
        await createQualityCheck(orderId, { result: 'pass' })
        showToast({ type: 'success', message: '质检通过，待结算' })
        loadData()
        break
      case 'qc_fail':
        await createQualityCheck(orderId, { result: 'fail' })
        showToast('质检不通过，已返回维修')
        loadData()
        break
      case 'receive_payment':
        if (!settlement.value) {
          await createSettlement(orderId)
          await loadData()
        }
        paymentForm.amount = unpaidAmount.value > 0 ? unpaidAmount.value.toFixed(2) : ''
        showPaymentPopup.value = true
        break
      case 'deliver':
        await showConfirmDialog({ title: '确认交车', message: '确认车辆已交付客户？' })
        await deliverOrder(orderId, {})
        showToast({ type: 'success', message: '交车完成' })
        loadData()
        break
      default:
        showToast('功能开发中')
    }
  } catch (e: any) {
    if (e !== 'cancel') { /* 已拦截 */ }
  }
}

onMounted(loadData)
</script>

<style scoped>
.status-card {
  background: linear-gradient(135deg, #1989fa, #07c160);
  color: #fff;
}
.status-card .plate {
  font-size: 20px;
  font-weight: 700;
}
.status-card .text-muted {
  color: rgba(255,255,255,0.8);
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-item {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}
.log-item {
  padding: 8px 0;
  border-bottom: 1px solid #f2f3f5;
}
.log-item:last-child {
  border-bottom: none;
}
.log-content {
  font-size: 14px;
  color: #323233;
  margin-bottom: 4px;
}
.payment-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f2f3f5;
}
.payment-item:last-child {
  border-bottom: none;
}
/* 增项 */
.additional-item {
  border-bottom: 1px solid #f2f3f5;
}
.additional-item:last-child {
  border-bottom: none;
}
.additional-actions {
  display: flex;
  gap: 8px;
  padding: 8px 16px 12px;
  justify-content: flex-end;
}
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
  display: flex;
  gap: 8px;
}
.action-bar .van-button {
  flex: 1;
}
/* 弹窗样式 */
.popup-content {
  padding: 20px 16px 32px;
  max-height: 85vh;
  overflow-y: auto;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 16px;
}
.payment-info {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
}
</style>
