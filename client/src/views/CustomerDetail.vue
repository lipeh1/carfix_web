<template>
  <div class="page-container">
    <van-nav-bar title="客户详情" left-text="返回" left-arrow @click-left="$router.back()">
      <template #right>
        <van-icon name="edit" size="18" @click="openEdit" />
      </template>
    </van-nav-bar>

    <div class="page-content" v-if="customer">
      <!-- 客户信息卡片 -->
      <div class="card customer-card">
        <div class="customer-avatar">{{ customer.name.charAt(0) }}</div>
        <div class="customer-info">
          <div class="customer-name">{{ customer.name }}</div>
          <div class="customer-phone" @click="callPhone">{{ customer.phone }}</div>
        </div>
        <van-icon name="phone-o" class="call-icon" @click="callPhone" />
      </div>

      <!-- 消费统计 -->
      <div class="card">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ customer.stats?.totalOrders || 0 }}</div>
            <div class="stat-label">总工单</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-success">{{ customer.stats?.completedOrders || 0 }}</div>
            <div class="stat-label">已完成</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-danger">¥{{ formatAmount(customer.stats?.totalSpent) }}</div>
            <div class="stat-label">累计消费</div>
          </div>
        </div>
        <div class="mt-12 text-muted" v-if="customer.stats?.lastVisit">
          最近到店：{{ formatDate(customer.stats.lastVisit) }}
        </div>
      </div>

      <!-- 备注 -->
      <div class="card" v-if="customer.remark">
        <div class="section-title">备注</div>
        <div class="remark-text">{{ customer.remark }}</div>
      </div>

      <!-- 名下车辆 -->
      <div class="card">
        <div class="flex-between mb-12">
          <span class="section-title" style="margin-bottom:0">名下车辆 ({{ customer.vehicles?.length || 0 }})</span>
        </div>
        <van-cell
          v-for="v in customer.vehicles"
          :key="v.id"
          :title="v.plateNumber"
          :label="`${v.brand || ''} ${v.model || ''}`"
          is-link
          @click="$router.push(`/vehicles/${v.id}`)"
        >
          <template #icon>
            <van-icon name="orders-o" style="margin-right:8px;color:var(--primary-hover)" />
          </template>
        </van-cell>
        <van-empty v-if="!customer.vehicles?.length" description="暂无车辆" image-size="60" />
      </div>

      <!-- 历史工单 -->
      <div class="card">
        <div class="section-title">历史工单 ({{ customer.workOrders?.length || 0 }})</div>
        <div
          v-for="o in customer.workOrders"
          :key="o.id"
          class="order-item"
          @click="$router.push(`/orders/${o.id}`)"
        >
          <div class="order-header">
            <span class="order-no">{{ o.orderNo }}</span>
            <van-tag :type="getStatusType(o.status)">{{ getStatusLabel(o.status) }}</van-tag>
          </div>
          <div class="order-vehicle">{{ o.vehicle?.plateNumber || '未知车辆' }}</div>
          <div class="order-complaint">{{ o.complaint || '无诉求' }}</div>
          <div class="order-footer">
            <span class="text-muted">{{ formatDate(o.createdAt) }}</span>
            <span class="order-amount" v-if="o.settlement?.actualAmount">
              ¥{{ formatAmount(o.settlement.actualAmount) }}
            </span>
          </div>
        </div>
        <van-empty v-if="!customer.workOrders?.length" description="暂无工单" image-size="60" />
      </div>

      <!-- 底部快捷操作 -->
      <div class="bottom-bar">
        <van-button type="primary" block icon="add" @click="$router.push('/checkin')">
          新建接车
        </van-button>
      </div>
    </div>

    <van-empty v-else-if="!loadFailed" description="加载中..." />
    <van-empty v-else image="error" description="加载失败，点击重试" @click="loadData" />

    <!-- 编辑客户弹窗 -->
    <van-popup v-model:show="showEdit" position="bottom" round>
      <div class="popup-content">
        <h3>编辑客户</h3>
        <van-field v-model="editForm.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="editForm.phone" label="电话" placeholder="请输入电话" type="tel" />
        <van-field v-model="editForm.remark" label="备注" type="textarea" rows="2" placeholder="可选" />
        <van-button type="primary" block class="mt-16" @click="submitEdit">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getCustomer, updateCustomer } from '@/api'
import dayjs from 'dayjs'
import { fenToYuan } from '@/utils/money'

const route = useRoute()
const customer = ref<any>(null)
const loadFailed = ref(false)
const showEdit = ref(false)
const editForm = reactive({ name: '', phone: '', remark: '' })

// 状态映射
const statusMap: Record<string, { label: string; type: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  pending_inspection: { label: '待检测', type: 'warning' },
  pending_quote: { label: '待报价', type: 'primary' },
  repairing: { label: '维修中', type: 'danger' },
  pending_quality_check: { label: '待质检', type: 'warning' },
  pending_settlement: { label: '待结算', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'default' }
}

const getStatusLabel = (s: string) => statusMap[s]?.label || s
const getStatusType = (s: string) => statusMap[s]?.type || 'default'
const formatDate = (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm')
const formatAmount = (n: number | string | null | undefined) => fenToYuan(n)

const callPhone = () => {
  if (customer.value?.phone) {
    window.location.href = `tel:${customer.value.phone}`
  }
}

const loadData = async () => {
  loadFailed.value = false
  try {
    customer.value = await getCustomer(Number(route.params.id))
  } catch (e) {
    // 展示失败态并允许点击重试
    loadFailed.value = true
  }
}

const openEdit = () => {
  editForm.name = customer.value.name
  editForm.phone = customer.value.phone
  editForm.remark = customer.value.remark || ''
  showEdit.value = true
}

const submitEdit = async () => {
  if (!editForm.name) return showToast('请输入姓名')
  if (!editForm.phone) return showToast('请输入电话')
  try {
    await updateCustomer(customer.value.id, editForm)
    showToast({ type: 'success', message: '保存成功' })
    showEdit.value = false
    loadData()
  } catch (e) { /* 已拦截 */ }
}

onMounted(loadData)
</script>

<style scoped>
/* 客户卡片：表面浮层 + 发丝线（不用彩色渐变） */
.customer-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-2);
}
.customer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  /* 主色低透明度底 + 提亮文字，克制使用主色 */
  background: rgba(94, 106, 210, 0.2);
  color: var(--primary-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
}
.customer-info {
  flex: 1;
}
.customer-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}
.customer-phone {
  font-size: 13px;
  color: var(--ink-muted);
  margin-top: 2px;
  font-family: var(--font-mono);
}
.call-icon {
  font-size: 24px;
  color: var(--ink-muted);
}
.stats-grid {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
}
.stat-label {
  font-size: 12px;
  color: var(--ink-subtle);
  margin-top: 4px;
}
.remark-text {
  font-size: 14px;
  color: var(--ink-muted);
  line-height: 1.6;
}
.order-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--hairline);
  cursor: pointer;
}
.order-item:last-child {
  border-bottom: none;
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.order-no {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-mono);
}
.order-vehicle {
  font-size: 13px;
  color: var(--primary-hover);
  margin-top: 4px;
}
.order-complaint {
  font-size: 13px;
  color: var(--ink-subtle);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.order-amount {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--danger);
}
/* 底部操作栏：发丝线上边框替代投影 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: var(--surface-1);
  border-top: 1px solid var(--hairline);
}
.popup-content {
  padding: 20px 16px 32px;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 16px;
}
</style>
