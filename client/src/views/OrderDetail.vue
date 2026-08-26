<template>
  <div class="page-container">
    <van-nav-bar :title="`工单 #${order?.order_no || ''}`" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content" v-if="order">
      <!-- 状态卡片 -->
      <div class="card status-card">
        <div class="flex-between">
          <div>
            <div class="plate">{{ order.vehicle?.plate_number }}</div>
            <div class="text-muted mt-8">{{ order.customer?.name }} · {{ order.customer?.phone }}</div>
          </div>
          <van-tag :type="getStatusType(order.status)" size="medium">
            {{ getStatusLabel(order.status) }}
          </van-tag>
        </div>
      </div>

      <!-- 接车信息 -->
      <div class="card">
        <div class="section-title">接车信息</div>
        <van-cell title="客户诉求" :value="order.complaint || '-'" />
        <van-cell title="接车里程" :value="order.mileage_in ? order.mileage_in + ' km' : '-'" />
        <van-cell title="创建时间" :value="formatDateTime(order.created_at)" />
      </div>

      <!-- 接车照片 -->
      <div class="card" v-if="checkinPhotos.length > 0">
        <div class="section-title">接车照片</div>
        <van-image-preview
          v-model:show="showPreview"
          :images="previewImages"
        />
        <div class="photo-grid">
          <img
            v-for="(photo, idx) in checkinPhotos"
            :key="photo.id"
            :src="photo.file_path"
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
          <div class="text-muted">{{ formatDateTime(log.created_at) }}</div>
        </div>
      </div>

      <!-- 增项 -->
      <div class="card" v-if="additionalItems.length > 0">
        <div class="section-title">维修增项</div>
        <van-cell
          v-for="item in additionalItems"
          :key="item.id"
          :title="item.name"
          :label="item.reason"
        >
          <template #value>
            <div style="text-align:right">
              <div>¥{{ Number(item.amount).toFixed(2) }}</div>
              <van-tag :type="item.status === 'confirmed' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'" >
                {{ item.status === 'confirmed' ? '已确认' : item.status === 'rejected' ? '已拒绝' : '待确认' }}
              </van-tag>
            </div>
          </template>
        </van-cell>
      </div>

      <!-- 结算信息 -->
      <div class="card" v-if="settlement">
        <div class="section-title">结算信息</div>
        <van-cell title="结算单号" :value="settlement.settlement_no" />
        <van-cell title="应收金额" :value="`¥${Number(settlement.total_amount).toFixed(2)}`" />
        <van-cell title="优惠" :value="`¥${Number(settlement.discount || 0).toFixed(2)}`" />
        <van-cell title="实收金额" :value="`¥${Number(settlement.actual_amount).toFixed(2)}`" />
        <van-cell title="已收金额" :value="`¥${Number(settlement.paid_amount).toFixed(2)}`" />
        <van-cell title="状态">
          <template #value>
            <van-tag :type="settlement.status === 'paid' ? 'success' : 'warning'" >
              {{ settlement.status === 'paid' ? '已结清' : '挂账' }}
            </van-tag>
          </template>
        </van-cell>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  getOrder, updateOrderStatus, addRepairLog,
  addAdditionalItem, confirmAdditionalItem,
  createQualityCheck, createSettlement, addPayment, deliverOrder
} from '@/api'
import dayjs from 'dayjs'

const route = useRoute()
const orderId = Number(route.params.id)

const order = ref<any>(null)
const checkinPhotos = ref<any[]>([])
const repairItems = ref<any[]>([])
const repairLogs = ref<any[]>([])
const additionalItems = ref<any[]>([])
const settlement = ref<any>(null)
const showPreview = ref(false)
const previewImages = ref<string[]>([])

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

const itemsTotal = computed(() =>
  repairItems.value.reduce((sum, i) => sum + Number(i.subtotal), 0)
)

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
    btns.push({ key: 'qc_fail', label: '质检不通过(返工)', type: 'danger' })
  }
  if (s === 'pending_settlement') {
    btns.push({ key: 'receive_payment', label: '收款', type: 'primary' })
    btns.push({ key: 'deliver', label: '交车', type: 'success' })
  }
  return btns
})

const loadData = async () => {
  try {
    const data: any = await getOrder(orderId)
    order.value = data
    checkinPhotos.value = data.checkin_photos || []
    repairItems.value = data.repair_items || []
    repairLogs.value = data.repair_logs || []
    additionalItems.value = data.additional_items || []
    settlement.value = data.settlement || null
  } catch (e) { /* 静默 */ }
}

const openPreview = (idx: number) => {
  previewImages.value = checkinPhotos.value.map((p: any) => p.file_path)
  showPreview.value = true
}

const handleAction = async (key: string) => {
  try {
    switch (key) {
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
      case 'finish_repair':
        await updateOrderStatus(orderId, 'pending_quality_check')
        showToast({ type: 'success', message: '维修完成' })
        loadData()
        break
      case 'qc_pass':
        await createQualityCheck(orderId, { result: 'pass' })
        showToast({ type: 'success', message: '质检通过' })
        loadData()
        break
      case 'qc_fail':
        await createQualityCheck(orderId, { result: 'fail' })
        showToast('已返工')
        loadData()
        break
      case 'receive_payment':
        if (!settlement.value) {
          await createSettlement(orderId)
        }
        showToast('请在结算页操作收款')
        loadData()
        break
      case 'deliver':
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
</style>
