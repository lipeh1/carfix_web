<template>
  <div class="page-container">
    <van-nav-bar title="提醒" />

    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="待提醒" name="pending" />
      <van-tab title="已提醒" name="done" />
      <van-tab title="全部" name="" />
    </van-tabs>

    <div class="page-content">
      <van-cell
        v-for="item in reminders"
        :key="item.id"
        :title="item.content || getTypeLabel(item.type)"
        :label="`${item.vehicle?.plateNumber || ''} · 建议 ${formatDate(item.remindDate)}`"
        is-link
        @click="showDetail(item)"
      >
        <template #right-icon>
          <van-tag :type="item.type === 'maintenance' ? 'warning' : 'primary'" >
            {{ getTypeLabel(item.type) }}
          </van-tag>
        </template>
      </van-cell>

      <van-empty v-if="reminders.length === 0" description="暂无提醒" />
    </div>

    <!-- 提醒详情弹窗 -->
    <van-popup v-model:show="showDetailPopup" position="bottom" round>
      <div class="popup-content" v-if="current">
        <h3>{{ getTypeLabel(current.type) }}</h3>
        <van-cell title="车辆" :value="current.vehicle?.plateNumber || '-'" />
        <van-cell title="建议日期" :value="formatDate(current.remindDate)" />
        <van-cell title="内容" :value="current.content || '-'" />
        <van-cell title="状态" :value="current.status === 'done' ? '已提醒' : '待提醒'" />
        <van-cell v-if="current.remindedAt" title="提醒时间" :value="formatDateTime(current.remindedAt)" />
        <van-cell v-if="current.feedback" title="客户反馈" :value="current.feedback" />

        <van-button
          v-if="current.status === 'pending'"
          type="primary"
          block
          class="mt-16"
          @click="markDone"
        >
          标记已提醒
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { showToast } from 'vant'
import { getReminders, updateReminder } from '@/api'
import dayjs from 'dayjs'

const activeTab = ref('pending')
const reminders = ref<any[]>([])
const showDetailPopup = ref(false)
const current = ref<any>(null)

const getTypeLabel = (t: string) => (t === 'maintenance' ? '保养提醒' : '回访提醒')
const formatDate = (d: string) => dayjs(d).format('YYYY-MM-DD')
const formatDateTime = (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm')

const loadData = async () => {
  try {
    const params: any = {}
    if (activeTab.value) params.status = activeTab.value
    const data = await getReminders(params)
    reminders.value = data as any[]
  } catch (e) {
    // 静默
  }
}

const showDetail = (item: any) => {
  current.value = item
  showDetailPopup.value = true
}

const markDone = async () => {
  if (!current.value) return
  try {
    await updateReminder(current.value.id, {
      status: 'done',
      remindedAt: new Date().toISOString(),
      remindMethod: 'wechat'
    })
    showToast({ type: 'success', message: '已标记' })
    showDetailPopup.value = false
    loadData()
  } catch (e) {
    // 已拦截
  }
}

watch(activeTab, loadData)
onMounted(loadData)
</script>

<style scoped>
.popup-content {
  padding: 20px 16px 32px;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 12px;
}
</style>
