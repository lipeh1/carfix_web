<template>
  <div class="page-container page-frame">
    <!-- 页头固定(应用化骨架),仅下方列表滚动 -->
    <van-nav-bar title="提醒" />

    <van-tabs v-model:active="activeTab">
      <van-tab title="待提醒" name="pending" />
      <van-tab title="已提醒" name="done" />
      <van-tab title="全部" name="" />
    </van-tabs>

    <div class="page-content scroll-area">
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

        <!-- 标记已提醒需记录方式与客户反馈（DESIGN.md 要求） -->
        <template v-if="current.status === 'pending'">
          <van-field name="remindMethod" label="提醒方式" class="mt-12">
            <template #input>
              <van-radio-group v-model="doneForm.method" direction="horizontal">
                <van-radio name="phone">电话</van-radio>
                <van-radio name="wechat">微信</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field
            v-model="doneForm.feedback"
            label="客户反馈"
            type="textarea"
            rows="2"
            placeholder="可选，记录客户回应"
          />
          <van-button type="primary" block class="mt-16" :loading="marking" @click="markDone">
            标记已提醒
          </van-button>
        </template>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { showToast } from 'vant'
import { getReminders, updateReminder } from '@/api'
import dayjs from 'dayjs'

const activeTab = ref('pending')
const reminders = ref<any[]>([])
const showDetailPopup = ref(false)
const current = ref<any>(null)
// 标记已提醒的补充信息
const doneForm = reactive({ method: 'wechat', feedback: '' })
// 标记中状态：防弱网双击重复提交
const marking = ref(false)

// 提醒类型标签（含挂账交车自动生成的催收提醒）
const getTypeLabel = (t: string) =>
  ({ maintenance: '保养提醒', follow_up: '回访提醒', collection: '催收提醒' } as Record<string, string>)[t] || '提醒'
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
  // 打开新条目时重置待填项，避免上一条的反馈串到下一条
  doneForm.method = 'wechat'
  doneForm.feedback = ''
  showDetailPopup.value = true
}

const markDone = async () => {
  if (!current.value || marking.value) return
  marking.value = true
  try {
    const payload: any = {
      status: 'done',
      remindedAt: new Date().toISOString(),
      remindMethod: doneForm.method
    }
    // 反馈选填，未填写则不更新该字段
    if (doneForm.feedback) payload.feedback = doneForm.feedback
    await updateReminder(current.value.id, payload)
    showToast({ type: 'success', message: '已标记' })
    showDetailPopup.value = false
    loadData()
  } catch (e) {
    // 已拦截
  } finally {
    marking.value = false
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
