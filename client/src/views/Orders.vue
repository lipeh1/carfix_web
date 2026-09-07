<template>
  <div class="page-container">
    <van-nav-bar title="工单" fixed placeholder />

    <!-- 搜索框 -->
    <van-search
      v-model="keyword"
      placeholder="搜索工单号/车牌号/客户名/诉求"
      show-action
      @search="onSearch"
      @clear="onSearch"
    >
      <template #action>
        <div @click="onSearch">搜索</div>
      </template>
    </van-search>

    <!-- 粘性吸顶时下移到悬浮导航栏(46px)之下 -->
    <van-tabs v-model:active="activeTab" sticky :offset-top="46" @change="onTabChange">
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
          <!-- 列表项进场：弹簧上移淡入，逐项错开形成级联；AnimatePresence 让搜索/切 tab 换批时旧项平滑退场 -->
          <AnimatePresence>
            <motion.div
              v-for="(order, idx) in orders"
              :key="order.id"
              :initial="{ opacity: 0, y: 10 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: -6, transition: { duration: 0.15 } }"
              :transition="{ type: 'spring', bounce: 0, duration: 0.35, delay: Math.min(idx * 0.03, 0.24) }"
            >
              <van-cell is-link @click="$router.push(`/orders/${order.id}`)">
                <template #title>
                  <div class="order-title">
                    <span class="plate">{{ order.vehicle?.plateNumber || '未知车辆' }}</span>
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
                  <div class="order-amount" v-if="order.finalAmount">
                    ¥{{ fenToYuan(order.finalAmount) }}
                  </div>
                </template>
              </van-cell>
            </motion.div>
          </AnimatePresence>
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 右下角新建接车按钮：按压弹簧缩放反馈（transform 由 motion 接管） -->
    <motion.div
      class="fab-button"
      :while-press="{ scale: 0.92 }"
      :transition="{ type: 'spring', bounce: 0, duration: 0.3 }"
      @click="$router.push('/checkin')"
    >
      <van-icon name="plus" size="24" />
    </motion.div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { motion } from 'motion-v'
import { getOrders } from '@/api'
import { fenToYuan } from '@/utils/money'

const route = useRoute()

const tabs = [
  { label: '全部', value: '' },
  { label: '待检测', value: 'pending_inspection' },
  { label: '待报价', value: 'pending_quote' },
  { label: '维修中', value: 'repairing' },
  { label: '待质检', value: 'pending_quality_check' },
  { label: '待结算', value: 'pending_settlement' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

// 支持 /orders?status=xxx 直达指定状态（首页概览数字跳转入口）
const queryStatus = route.query.status as string
const activeTab = ref(tabs.some(t => t.value === queryStatus) ? queryStatus : '')
const keyword = ref('')
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
  loading.value = true
  try {
    const params: any = {}
    if (activeTab.value) params.status = activeTab.value
    if (keyword.value) params.keyword = keyword.value
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

const onSearch = () => {
  orders.value = []
  finished.value = false
  loadOrders()
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
  /* 车牌号用等宽字体便于快速比对 */
  font-family: var(--font-mono);
}
.order-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.order-amount {
  font-family: var(--font-mono);
  color: var(--danger);
  font-weight: 600;
  margin-top: 4px;
}
/* 右下角浮动按钮：主色圆钮，深色底用暗投影而非彩色光晕；避开 tabbar + 安全区 */
.fab-button {
  position: fixed;
  right: 20px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 100;
  cursor: pointer;
}
</style>
