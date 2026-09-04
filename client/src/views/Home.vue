<template>
  <div class="page-container">
    <van-nav-bar title="工作台" />

    <div class="page-content">
      <!-- 安装到桌面引导（移动端显示） -->
      <InstallGuide />

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <van-button type="primary" icon="add" @click="$router.push('/checkin')">
          新建接车
        </van-button>
        <van-button type="default" icon="chart-trending-o" @click="$router.push('/stats')">
          统计报表
        </van-button>
      </div>

      <!-- 今日概览 -->
      <div class="card">
        <div class="section-title">今日概览</div>
        <van-grid :column-num="4" :border="false">
          <van-grid-item icon="orders-o" :text="`待检测 ${stats.pendingInspection}`" />
          <van-grid-item icon="todo-list-o" :text="`维修中 ${stats.repairing}`" />
          <van-grid-item icon="balance-list-o" :text="`待结算 ${stats.pendingSettlement}`" />
          <van-grid-item icon="checked" :text="`已完成 ${stats.completed}`" />
        </van-grid>
      </div>

      <!-- 本月营收 -->
      <div class="card">
        <div class="flex-between">
          <span class="section-title" style="margin-bottom:0">本月营收</span>
          <span class="amount">¥{{ monthlyRevenueDisplay }}</span>
        </div>
      </div>

      <!-- 待办提醒 -->
      <div class="card" v-if="pendingReminders.length > 0">
        <div class="section-title">待办提醒</div>
        <van-cell
          v-for="item in pendingReminders"
          :key="item.id"
          :title="item.content || (item.type === 'maintenance' ? '保养提醒' : '回访提醒')"
          :label="item.vehicle?.plateNumber + ' · ' + formatDate(item.remindDate)"
          is-link
          @click="$router.push('/reminders')"
        />
      </div>

      <!-- 挂账提醒 -->
      <div class="card" v-if="stats.unpaidAmount > 0">
        <div class="flex-between">
          <span class="text-danger">挂账未收</span>
          <span class="amount">¥{{ fenToYuan(stats.unpaidAmount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getDashboard, getReminders } from '@/api'
import dayjs from 'dayjs'
import { fenToYuan } from '@/utils/money'
import { useAnimatedYuan } from '@/utils/countup'
import InstallGuide from '@/components/InstallGuide.vue'

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
.quick-actions .van-button {
  flex: 1;
}
</style>
