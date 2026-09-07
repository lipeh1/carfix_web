<template>
  <div class="page-container page-frame">
    <!-- 页头固定(应用化骨架),仅下方内容滚动 -->
    <van-nav-bar title="工作台" />

    <div class="page-content scroll-area">
      <!-- 安装到桌面引导（移动端显示） -->
      <InstallGuide />

      <!-- 快捷操作：包裹层带按压弹簧反馈 -->
      <motion.div class="quick-actions" :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="springIn(0)">
        <motion.div class="qa-btn" :while-press="{ scale: 0.96 }" :transition="pressSpring" @click="$router.push('/checkin')">
          <van-button type="primary" icon="add" block>新建接车</van-button>
        </motion.div>
        <motion.div class="qa-btn" :while-press="{ scale: 0.96 }" :transition="pressSpring" @click="$router.push('/stats')">
          <van-button type="default" icon="chart-trending-o" block>统计报表</van-button>
        </motion.div>
      </motion.div>

      <!-- 各卡片按序级联进场（每张错开 50ms 的临界阻尼弹簧） -->
      <motion.div :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="springIn(0.05)">
        <!-- 今日概览：点击数字直达对应状态的工单列表 -->
        <div class="card">
          <div class="section-title">今日概览</div>
          <van-grid class="quick-grid" :column-num="4" :border="false">
            <van-grid-item icon="orders-o" :text="`待检测 ${stats.pendingInspection}`" @click="goOrders('pending_inspection')" />
            <van-grid-item icon="todo-list-o" :text="`维修中 ${stats.repairing}`" @click="goOrders('repairing')" />
            <van-grid-item icon="balance-list-o" :text="`待结算 ${stats.pendingSettlement}`" @click="goOrders('pending_settlement')" />
            <van-grid-item icon="checked" :text="`已完成 ${stats.completed}`" @click="goOrders('completed')" />
          </van-grid>
        </div>
      </motion.div>

      <!-- 挂账提醒：点击直达统计页挂账明细 -->
      <motion.div v-if="stats.unpaidAmount > 0" :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="springIn(0.1)">
        <div class="card click-card pressable" @click="$router.push('/stats')">
          <div class="flex-between">
            <span class="text-danger">挂账未收</span>
            <span class="amount">¥{{ fenToYuan(stats.unpaidAmount) }}</span>
          </div>
        </div>
      </motion.div>

      <!-- 本月营收 -->
      <motion.div :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="springIn(0.15)">
        <div class="card">
          <div class="flex-between">
            <span class="section-title" style="margin-bottom:0">本月营收</span>
            <span class="amount">¥{{ monthlyRevenueDisplay }}</span>
          </div>
        </div>
      </motion.div>

      <!-- 待办提醒 -->
      <motion.div v-if="pendingReminders.length > 0" :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="springIn(0.2)">
        <div class="card">
          <div class="section-title">待办提醒</div>
          <van-cell
            v-for="item in pendingReminders"
            :key="item.id"
            :title="item.content || reminderTypeLabel(item.type)"
            :label="item.vehicle?.plateNumber + ' · ' + formatDate(item.remindDate)"
            is-link
            @click="$router.push('/reminders')"
          />
        </div>
      </motion.div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { getDashboard, getReminders } from '@/api'
import dayjs from 'dayjs'
import { fenToYuan } from '@/utils/money'
import { useAnimatedYuan } from '@/utils/countup'
import InstallGuide from '@/components/InstallGuide.vue'

const router = useRouter()

// 级联进场弹簧：临界阻尼 + 按卡片序错开的延迟
const springIn = (delay: number) => ({ type: 'spring', bounce: 0, duration: 0.4, delay })
// 按压反馈弹簧：按下缩放、松开弹回
const pressSpring = { type: 'spring', bounce: 0, duration: 0.3 }

const stats = ref({
  pendingInspection: 0,
  repairing: 0,
  pendingSettlement: 0,
  completed: 0,
  monthlyRevenue: 0,
  unpaidAmount: 0
})

// 本月营收数字滚动展示（分值驱动）
const monthlyRevenueFen = computed(() => stats.value.monthlyRevenue)
const monthlyRevenueDisplay = useAnimatedYuan(monthlyRevenueFen)

const pendingReminders = ref<any[]>([])

const formatDate = (d: string) => dayjs(d).format('MM-DD')
// 提醒类型标签（含催收）
const reminderTypeLabel = (t: string) => ({ maintenance: '保养提醒', follow_up: '回访提醒', collection: '催收提醒' } as Record<string, string>)[t] || '提醒'

// 概览数字直达对应状态工单列表
const goOrders = (status: string) => {
  router.push({ path: '/orders', query: { status } })
}

const loadData = async () => {
  try {
    const [dash, reminders] = await Promise.all([
      getDashboard(),
      getReminders({ status: 'pending' })
    ])
    stats.value = dash
    pendingReminders.value = (reminders as any[]).slice(0, 5)
  } catch (e) {
    // 后端未启动时静默
  }
}

onMounted(loadData)
</script>

<style scoped>
.quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
/* 包裹层平分宽度，内部按钮撑满（按压缩放作用在包裹层上） */
.qa-btn {
  flex: 1;
}
.click-card {
  cursor: pointer;
}
.click-card:active {
  background: var(--surface-2);
}
/* 概览宫格按压反馈：按下轻微缩小 + 背景抬升 */
.quick-grid :deep(.van-grid-item__content) {
  transition: transform 0.12s ease-out, background-color 0.12s ease-out;
  border-radius: 8px;
}
.quick-grid :deep(.van-grid-item:active .van-grid-item__content) {
  transform: scale(0.96);
  background: var(--surface-2);
}
</style>
