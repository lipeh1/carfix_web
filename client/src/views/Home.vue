<template>
  <div class="page-container page-frame">
    <!-- 页头固定(应用化骨架),仅下方内容滚动 -->
    <van-nav-bar title="工作台">
      <template #right>
        <van-icon name="setting-o" size="20" class="pressable" @click="openSettings" />
      </template>
    </van-nav-bar>

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
          <!-- 加载骨架:四格占位,数据到达后换成真实宫格 -->
          <div v-if="loading" class="overview-sk">
            <div v-for="i in 4" :key="i" class="sk" style="height: 44px"></div>
          </div>
          <van-grid v-else class="quick-grid" :column-num="4" :border="false">
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
            <span v-if="loading" class="sk" style="width: 96px; height: 18px"></span>
            <span v-else class="amount">¥{{ monthlyRevenueDisplay }}</span>
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

    <!-- 设置动作面板:修改密码 / 退出登录 -->
    <van-action-sheet
      v-model:show="showActions"
      :actions="[{ name: '修改密码' }, { name: '退出登录' }]"
      cancel-text="取消"
      @select="onActionSelect"
    />

    <!-- 修改密码弹窗 -->
    <van-popup v-model:show="showChangePwd" position="bottom" round>      <div class="popup-content">
        <h3>修改密码</h3>
        <van-field v-model="pwdForm.old" type="password" label="原密码" placeholder="当前访问密码" :maxlength="32" />
        <van-field v-model="pwdForm.next" type="password" label="新密码" placeholder="至少 6 位" :maxlength="32" />
        <van-field v-model="pwdForm.confirm" type="password" label="确认新密码" placeholder="再次输入新密码" :maxlength="32" />
        <van-button type="primary" block class="mt-16" :loading="changingPwd" @click="submitChangePwd">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { showToast, showConfirmDialog } from 'vant'
import { getDashboard, getReminders, logout, changePassword } from '@/api'
import dayjs from 'dayjs'
import { fenToYuan } from '@/utils/money'
import { useAnimatedYuan } from '@/utils/countup'
import InstallGuide from '@/components/InstallGuide.vue'
import { hapticFeedback } from '@/utils/feedback'

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
// 首次加载中状态,驱动概览/营收骨架
const loading = ref(true)

const formatDate = (d: string) => dayjs(d).format('MM-DD')
// 提醒类型标签（含催收）
const reminderTypeLabel = (t: string) => ({ maintenance: '保养提醒', follow_up: '回访提醒', collection: '催收提醒' } as Record<string, string>)[t] || '提醒'

// 概览数字直达对应状态工单列表
const goOrders = (status: string) => {
  router.push({ path: '/orders', query: { status } })
}

const loadData = async () => {
  loading.value = true
  try {
    const [dash, reminders] = await Promise.all([
      getDashboard(),
      getReminders({ status: 'pending' })
    ])
    stats.value = dash
    pendingReminders.value = (reminders as any[]).slice(0, 5)
  } catch (e) {
    // 后端未启动时静默
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ===== 访问控制入口:修改密码 / 退出登录 =====
const showActions = ref(false)
const openSettings = () => { showActions.value = true }

const onActionSelect = async (action: { name: string }) => {
  showActions.value = false
  if (action.name === '修改密码') {
    pwdForm.old = ''
    pwdForm.next = ''
    pwdForm.confirm = ''
    showChangePwd.value = true
    return
  }
  try {
    await showConfirmDialog({ title: '退出登录', message: '确定退出当前会话？' })
    await logout()
    router.replace('/login')
  } catch { /* 取消 */ }
}

const showChangePwd = ref(false)
const changingPwd = ref(false)
const pwdForm = reactive({ old: '', next: '', confirm: '' })

const submitChangePwd = async () => {
  if (changingPwd.value) return
  if (!pwdForm.old) return showToast('请输入原密码')
  if (pwdForm.next.length < 6) return showToast('新密码至少 6 位')
  if (pwdForm.next !== pwdForm.confirm) return showToast('两次输入的新密码不一致')
  changingPwd.value = true
  try {
    await changePassword({ oldPassword: pwdForm.old, newPassword: pwdForm.next })
    showToast({ type: 'success', message: '密码已更新' })
    hapticFeedback()
    showChangePwd.value = false
  } catch (e) { /* 已拦截 */ }
  finally {
    changingPwd.value = false
  }
}
</script>

<style scoped>
.popup-content {
  padding: 20px 16px 32px;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 12px;
}
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
/* 概览骨架:与四列宫格同布局 */
.overview-sk {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
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
