<template>
  <div class="page-container">
    <van-nav-bar title="统计报表" />

    <div class="page-content" v-if="stats">
      <!-- 基础数据概览 -->
      <div class="card">
        <div class="section-title">数据概览</div>
        <div class="overview-grid">
          <div class="overview-item">
            <div class="overview-value">{{ stats.overview?.customerCount || 0 }}</div>
            <div class="overview-label">客户数</div>
          </div>
          <div class="overview-item">
            <div class="overview-value">{{ stats.overview?.vehicleCount || 0 }}</div>
            <div class="overview-label">车辆数</div>
          </div>
          <div class="overview-item">
            <div class="overview-value">{{ stats.overview?.totalOrders || 0 }}</div>
            <div class="overview-label">总工单</div>
          </div>
          <div class="overview-item">
            <div class="overview-value text-danger">¥{{ formatAmount(stats.overview?.totalRevenue) }}</div>
            <div class="overview-label">总营收</div>
          </div>
        </div>
      </div>

      <!-- 月度营收趋势 -->
      <div class="card">
        <div class="section-title">近6个月营收趋势</div>
        <div class="chart-container">
          <div class="chart-bars">
            <div v-for="m in stats.months" :key="m.month" class="chart-bar-wrapper">
              <div class="chart-bar" :style="{ height: getBarHeight(m.revenue) + '%' }">
                <span class="chart-bar-value" v-if="m.revenue > 0">¥{{ formatAmount(m.revenue) }}</span>
              </div>
              <div class="chart-bar-label">{{ m.month.slice(5) }}</div>
            </div>
          </div>
        </div>
        <div class="chart-summary mt-12">
          <span>6个月合计：<span class="text-danger amount">¥{{ formatAmount(total6Months) }}</span></span>
          <span class="text-muted">工单 {{ total6MonthsOrders }} 单</span>
        </div>
      </div>

      <!-- 工单状态分布 -->
      <div class="card">
        <div class="section-title">工单状态分布</div>
        <div class="status-list">
          <div v-for="s in statusList" :key="s.status" class="status-row">
            <div class="status-left">
              <van-tag :type="s.type">{{ s.label }}</van-tag>
            </div>
            <div class="status-bar">
              <div class="status-bar-fill" :type="s.type" :style="{ width: getStatusPercent(s.status) + '%', background: s.color }"></div>
            </div>
            <div class="status-count">{{ getStatusCount(s.status) }}</div>
          </div>
        </div>
      </div>

      <!-- 维修项目排行 -->
      <div class="card">
        <div class="section-title">维修项目热度排行</div>
        <div v-if="stats.topItems?.length" class="rank-list">
          <div v-for="(item, idx) in stats.topItems" :key="item.name" class="rank-item">
            <div class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</div>
            <div class="rank-info">
              <div class="rank-name">{{ item.name }}</div>
              <div class="rank-meta">
                <span>{{ item.count }}次</span>
                <span class="text-muted">· 累计 ¥{{ formatAmount(item.total) }}</span>
              </div>
            </div>
            <div class="rank-amount">¥{{ formatAmount(item.total) }}</div>
          </div>
        </div>
        <van-empty v-else description="暂无数据" image-size="60" />
      </div>

      <!-- 挂账汇总 -->
      <div class="card">
        <div class="flex-between mb-12">
          <span class="section-title" style="margin-bottom:0">挂账明细</span>
          <span class="amount">¥{{ formatAmount(stats.unpaid?.total) }}</span>
        </div>
        <div v-if="stats.unpaid?.list?.length" class="unpaid-list">
          <div
            v-for="item in stats.unpaid.list"
            :key="item.id"
            class="unpaid-item"
            @click="$router.push(`/orders/${item.orderId}`)"
          >
            <div class="unpaid-header">
              <span class="unpaid-customer">{{ item.customerName || '未知客户' }}</span>
              <span class="unpaid-plate">{{ item.plateNumber }}</span>
            </div>
            <div class="unpaid-no">{{ item.settlementNo }}</div>
            <div class="unpaid-footer">
              <span class="text-muted">{{ formatDate(item.createdAt) }}</span>
              <span class="text-danger">欠 ¥{{ formatAmount(item.unpaidAmount) }}</span>
            </div>
          </div>
        </div>
        <van-empty v-else description="暂无挂账" image-size="60" />
      </div>
    </div>

    <van-empty v-else-if="!loadFailed" description="加载中..." />
    <van-empty v-else image="error" description="加载失败，点击重试" @click="loadData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getStats } from '@/api'
import { fenToYuan } from '@/utils/money'
import dayjs from 'dayjs'

const stats = ref<any>(null)
const loadFailed = ref(false)

// 状态定义（用于展示）
const statusList: Array<{ status: string; label: string; type: 'default' | 'primary' | 'success' | 'warning' | 'danger'; color: string }> = [
  { status: 'pending_inspection', label: '待检测', type: 'warning', color: '#ff976a' },
  { status: 'pending_quote', label: '待报价', type: 'primary', color: '#1989fa' },
  { status: 'repairing', label: '维修中', type: 'danger', color: '#ee0a24' },
  { status: 'pending_quality_check', label: '待质检', type: 'warning', color: '#ff976a' },
  { status: 'pending_settlement', label: '待结算', type: 'primary', color: '#1989fa' },
  { status: 'completed', label: '已完成', type: 'success', color: '#07c160' },
  { status: 'cancelled', label: '已取消', type: 'default', color: '#c8c9cc' }
]

const formatDate = (d: string) => dayjs(d).format('YYYY-MM-DD')
const formatAmount = (n: number | string | null | undefined) => fenToYuan(n)

// 近6个月营收总额
const total6Months = computed(() =>
  (stats.value?.months || []).reduce((sum: number, m: any) => sum + (m.revenue || 0), 0)
)
const total6MonthsOrders = computed(() =>
  (stats.value?.months || []).reduce((sum: number, m: any) => sum + (m.orderCount || 0), 0)
)

// 柱状图高度（最大营收为100%）
const maxRevenue = computed(() => {
  const revenues = (stats.value?.months || []).map((m: any) => m.revenue || 0)
  return Math.max(...revenues, 1)
})
const getBarHeight = (revenue: number) => (revenue / maxRevenue.value) * 100

// 工单状态统计
const totalOrders = computed(() =>
  (stats.value?.statusDistribution || []).reduce((sum: number, s: any) => sum + (s.count || 0), 0)
)
const getStatusCount = (status: string) => {
  const item = (stats.value?.statusDistribution || []).find((s: any) => s.status === status)
  return item?.count || 0
}
const getStatusPercent = (status: string) => {
  if (totalOrders.value === 0) return 0
  return (getStatusCount(status) / totalOrders.value) * 100
}

const loadData = async () => {
  loadFailed.value = false
  try {
    stats.value = await getStats()
  } catch (e) {
    // 展示失败态并允许点击重试
    loadFailed.value = true
  }
}

onMounted(loadData)
</script>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.overview-item {
  text-align: center;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
}
.overview-value {
  font-size: 20px;
  font-weight: 700;
  color: #323233;
}
.overview-label {
  font-size: 12px;
  color: #969799;
  margin-top: 4px;
}
/* 柱状图 */
.chart-container {
  padding: 10px 0;
}
.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 160px;
  padding: 0 8px;
}
.chart-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}
.chart-bar {
  width: 28px;
  background: linear-gradient(180deg, #1989fa, #07c160);
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 2px;
  display: flex;
  justify-content: center;
  transition: height 0.3s;
}
.chart-bar-value {
  position: absolute;
  top: -18px;
  font-size: 10px;
  color: #646566;
  white-space: nowrap;
}
.chart-bar-label {
  font-size: 11px;
  color: #969799;
  margin-top: 6px;
}
.chart-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
}
/* 状态分布 */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-left {
  width: 70px;
  flex-shrink: 0;
}
.status-bar {
  flex: 1;
  height: 12px;
  background: #f2f3f5;
  border-radius: 6px;
  overflow: hidden;
}
.status-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s;
}
.status-count {
  width: 30px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}
/* 排行榜 */
.rank-list {
  display: flex;
  flex-direction: column;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f2f3f5;
}
.rank-item:last-child {
  border-bottom: none;
}
.rank-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: #f2f3f5;
  color: #969799;
  flex-shrink: 0;
}
.rank-1 { background: #ffd700; color: #fff; }
.rank-2 { background: #c0c0c0; color: #fff; }
.rank-3 { background: #cd7f32; color: #fff; }
.rank-info {
  flex: 1;
}
.rank-name {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}
.rank-meta {
  font-size: 12px;
  color: #646566;
  margin-top: 2px;
}
.rank-amount {
  font-size: 14px;
  font-weight: 600;
  color: #ee0a24;
}
/* 挂账列表 */
.unpaid-list {
  display: flex;
  flex-direction: column;
}
.unpaid-item {
  padding: 12px 0;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
}
.unpaid-item:last-child {
  border-bottom: none;
}
.unpaid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.unpaid-customer {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.unpaid-plate {
  font-size: 13px;
  color: #1989fa;
}
.unpaid-no {
  font-size: 12px;
  color: #969799;
  margin-top: 4px;
}
.unpaid-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
</style>
