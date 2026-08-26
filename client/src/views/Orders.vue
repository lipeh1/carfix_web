<template>
  <div class="page-container">
    <van-nav-bar title="工单" />

    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab v-for="tab in tabs" :key="tab.value" :title="tab.label" :name="tab.value" />
    </van-tabs>

    <div class="page-content">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadOrders"
        >
          <van-cell
            v-for="order in orders"
            :key="order.id"
            is-link
            @click="$router.push(`/orders/${order.id}`)"
          >
            <template #title>
              <div class="order-title">
                <span class="plate">{{ order.vehicle?.plate_number || '未知车辆' }}</span>
                <van-tag :type="getStatusType(order.status)" >
                  {{ getStatusLabel(order.status) }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="order-info">
                <span>{{ order.customer?.name || '未知客户' }}</span>
                <span class="text-muted">{{ order.complaint || '无诉求' }}</span>
              </div>
              <div class="order-amount" v-if="order.final_amount">
                ¥{{ Number(order.final_amount).toFixed(2) }}
              </div>
            </template>
          </van-cell>
        </van-list>
      </van-pull-refresh>
    </div>

    <van-fab icon="plus" @click="$router.push('/checkin')" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getOrders } from '@/api'

const tabs = [
  { label: '全部', value: '' },
  { label: '待检测', value: 'pending_inspection' },
  { label: '待报价', value: 'pending_quote' },
  { label: '维修中', value: 'repairing' },
  { label: '待质检', value: 'pending_quality_check' },
  { label: '待结算', value: 'pending_settlement' },
  { label: '已完成', value: 'completed' }
]

const activeTab = ref('')
const orders = ref<any[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

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

const loadOrders = async () => {
  try {
    const params: any = {}
    if (activeTab.value) params.status = activeTab.value
    const data = await getOrders(params)
    orders.value = data as any[]
    finished.value = true
  } catch (e) {
    // 静默
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onTabChange = () => {
  orders.value = []
  finished.value = false
  loadOrders()
}

const onRefresh = () => {
  finished.value = false
  loadOrders()
}

onMounted(loadOrders)
</script>

<style scoped>
.order-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.plate {
  font-weight: 600;
}
.order-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.order-amount {
  color: #ee0a24;
  font-weight: 600;
  margin-top: 4px;
}
</style>
