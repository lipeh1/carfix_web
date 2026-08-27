<template>
  <div class="page-container">
    <van-nav-bar title="车辆详情" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content" v-if="vehicle">
      <!-- 车辆信息卡片 -->
      <div class="card vehicle-card">
        <div class="vehicle-plate">{{ vehicle.plateNumber }}</div>
        <div class="vehicle-model">{{ vehicle.brand || '' }} {{ vehicle.model || '' }}</div>
        <div class="vehicle-meta">
          <span v-if="vehicle.year">{{ vehicle.year }}款</span>
          <span v-if="vehicle.color">· {{ vehicle.color }}</span>
          <span v-if="vehicle.vin">· VIN: {{ vehicle.vin }}</span>
        </div>
      </div>

      <!-- 维修统计 -->
      <div class="card">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ vehicle.stats?.totalRepairs || 0 }}</div>
            <div class="stat-label">维修次数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-danger">¥{{ formatAmount(vehicle.stats?.totalSpent) }}</div>
            <div class="stat-label">累计消费</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-muted" style="font-size:14px">{{ vehicle.stats?.lastRepair ? formatDate(vehicle.stats.lastRepair) : '暂无' }}</div>
            <div class="stat-label">最近维修</div>
          </div>
        </div>
        <!-- 常见维修项目 -->
        <div class="common-items" v-if="vehicle.stats?.commonItems?.length">
          <div class="text-muted mb-8">常见维修项目</div>
          <div class="item-tags">
            <van-tag v-for="item in vehicle.stats.commonItems" :key="item.name" type="primary" plain>
              {{ item.name }} ({{ item.count }})
            </van-tag>
          </div>
        </div>
      </div>

      <!-- 所属客户 -->
      <div class="card" v-if="vehicle.customer">
        <div class="section-title">所属客户</div>
        <van-cell
          :title="vehicle.customer.name"
          :label="vehicle.customer.phone"
          is-link
          @click="$router.push(`/customers/${vehicle.customer.id}`)"
        >
          <template #icon>
            <van-icon name="contact" style="margin-right:8px;color:var(--primary-hover)" />
          </template>
        </van-cell>
      </div>

      <!-- 保养提醒 -->
      <div class="card" v-if="vehicle.reminders?.length">
        <div class="section-title">待办提醒 ({{ vehicle.reminders.length }})</div>
        <div v-for="r in vehicle.reminders" :key="r.id" class="reminder-item">
          <van-icon :name="r.type === 'maintenance' ? 'setting-o' : 'chat-o'" class="reminder-icon" />
          <div class="reminder-content">
            <div class="reminder-title">{{ r.type === 'maintenance' ? '保养提醒' : '回访提醒' }}</div>
            <div class="reminder-desc">{{ r.content || '请及时联系客户' }}</div>
            <div class="text-muted">建议日期：{{ formatDate(r.remindDate) }}</div>
          </div>
        </div>
      </div>

      <!-- 维修历史时间线 -->
      <div class="card">
        <div class="section-title">维修历史 ({{ vehicle.workOrders?.length || 0 }})</div>
        <div class="timeline" v-if="vehicle.workOrders?.length">
          <div v-for="(o, idx) in vehicle.workOrders" :key="o.id" class="timeline-item">
            <div class="timeline-dot" :class="{ 'dot-completed': o.status === 'completed', 'dot-cancelled': o.status === 'cancelled' }"></div>
            <div class="timeline-content" @click="$router.push(`/orders/${o.id}`)">
              <div class="timeline-header">
                <span class="timeline-date">{{ formatDate(o.createdAt) }}</span>
                <van-tag :type="getStatusType(o.status)" size="medium">{{ getStatusLabel(o.status) }}</van-tag>
              </div>
              <div class="timeline-order">{{ o.orderNo }}</div>
              <div class="timeline-complaint">{{ o.complaint || '无诉求' }}</div>
              <!-- 维修项目 -->
              <div class="timeline-items" v-if="o.repairItems?.length">
                <span v-for="item in o.repairItems.slice(0, 3)" :key="item.id" class="item-chip">
                  {{ item.name }}
                </span>
                <span v-if="o.repairItems.length > 3" class="item-chip">+{{ o.repairItems.length - 3 }}</span>
              </div>
              <div class="timeline-amount" v-if="o.settlement?.actualAmount">
                消费 ¥{{ formatAmount(o.settlement.actualAmount) }}
              </div>
            </div>
          </div>
        </div>
        <van-empty v-else description="暂无维修记录" image-size="60" />
      </div>
    </div>

    <van-empty v-else-if="!loadFailed" description="加载中..." />
    <van-empty v-else image="error" description="加载失败，点击重试" @click="loadData" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getVehicle } from '@/api'
import dayjs from 'dayjs'
import { fenToYuan } from '@/utils/money'

const route = useRoute()
const vehicle = ref<any>(null)
const loadFailed = ref(false)

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

const loadData = async () => {
  loadFailed.value = false
  try {
    vehicle.value = await getVehicle(Number(route.params.id))
  } catch (e) {
    // 展示失败态并允许点击重试
    loadFailed.value = true
  }
}

onMounted(loadData)
</script>

<style scoped>
/* 车辆卡片：表面浮层，车牌放大等宽展示（不用彩色渐变） */
.vehicle-card {
  background: var(--surface-2);
  text-align: center;
}
.vehicle-plate {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
  font-family: var(--font-mono);
}
.vehicle-model {
  font-size: 15px;
  margin-top: 6px;
  color: var(--ink-muted);
}
.vehicle-meta {
  font-size: 12px;
  margin-top: 4px;
  color: var(--ink-subtle);
  font-family: var(--font-mono);
}
.stats-grid {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
  flex: 1;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.stat-label {
  font-size: 12px;
  color: var(--ink-subtle);
  margin-top: 4px;
}
.common-items {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--hairline);
}
.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.reminder-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--hairline);
}
.reminder-item:last-child {
  border-bottom: none;
}
.reminder-icon {
  font-size: 20px;
  color: var(--warning);
  margin-top: 2px;
}
.reminder-content {
  flex: 1;
}
.reminder-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.reminder-desc {
  font-size: 13px;
  color: var(--ink-muted);
  margin: 2px 0;
}
/* 时间线样式 */
.timeline {
  position: relative;
  padding-left: 20px;
}
.timeline-item {
  position: relative;
  padding-bottom: 20px;
}
.timeline-item:last-child {
  padding-bottom: 0;
}
.timeline-item::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 8px;
  bottom: -8px;
  width: 2px;
  background: var(--hairline);
}
.timeline-item:last-child::before {
  display: none;
}
/* 时间线节点：实心主色圆点 + 表面同色描边替代白边 */
.timeline-dot {
  position: absolute;
  left: -20px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid var(--surface-1);
  box-shadow: 0 0 0 2px var(--primary);
}
.dot-completed {
  background: var(--success);
  box-shadow: 0 0 0 2px var(--success);
}
.dot-cancelled {
  background: var(--ink-tertiary);
  box-shadow: 0 0 0 2px var(--ink-tertiary);
}
.timeline-content {
  cursor: pointer;
  padding: 4px 0;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.timeline-date {
  font-size: 12px;
  color: var(--ink-subtle);
}
.timeline-order {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  margin-top: 4px;
  font-family: var(--font-mono);
}
.timeline-complaint {
  font-size: 13px;
  color: var(--ink-subtle);
  margin-top: 2px;
}
.timeline-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
/* 项目小标签：表面2底色 pill */
.item-chip {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--surface-2);
  border-radius: 9999px;
  color: var(--ink-muted);
}
.timeline-amount {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--danger);
  margin-top: 6px;
}
</style>
