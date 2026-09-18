<!-- 访问验证页：首次进入引导设置访问密码,之后凭密码登录（单用户访问控制,见服务端 auth 路由） -->
<template>
  <div class="login-page">
    <div class="login-box">
      <img src="/icons/icon-192.png" class="login-icon" alt="" />
      <div class="login-title">汽修管理系统</div>
      <div class="login-sub">{{ initialized ? '输入访问密码继续' : '首次使用，请设置访问密码' }}</div>

      <van-form @submit="submit">
        <van-cell-group inset class="login-fields">
          <van-field
            v-model="password"
            type="password"
            name="password"
            :placeholder="initialized ? '访问密码' : '设置密码（至少 6 位）'"
            :maxlength="32"
            clearable
            autocapitalize="off"
            autocorrect="off"
            autocomplete="off"
            :spellcheck="false"
          />
          <!-- 首次设置需二次确认,避免手误锁死 -->
          <van-field
            v-if="!initialized"
            v-model="confirm"
            type="password"
            name="confirm"
            placeholder="确认密码"
            :maxlength="32"
            autocapitalize="off"
            autocorrect="off"
            autocomplete="off"
            :spellcheck="false"
          />
        </van-cell-group>
        <van-button type="primary" block class="login-btn" native-type="submit" :loading="loading">
          {{ initialized ? '进入系统' : '保存并进入' }}
        </van-button>
      </van-form>

      <div class="login-tip">{{ initialized ? '密码用于保护客户与经营数据' : '密码丢失需在服务器数据库清除 settings 表后重新设置' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getAuthStatus, getAuthMe, setupPassword, loginPassword } from '@/api'
import { hapticFeedback } from '@/utils/feedback'

const router = useRouter()

// 是否已初始化密码:决定展示"设置"还是"登录"形态
const initialized = ref(true)
const password = ref('')
const confirm = ref('')
const loading = ref(false)

onMounted(async () => {
  try {
    // 已持有有效会话则直接进入系统
    await getAuthMe()
    router.replace('/')
    return
  } catch { /* 未登录,继续 */ }
  try {
    const s: any = await getAuthStatus()
    initialized.value = !!s.initialized
  } catch { /* 状态拉取失败按登录形态展示 */ }
})

const submit = async () => {
  if (loading.value) return
  // 密码去首尾空格后再提交，杜绝手滑空格导致的"设置时与登录时不一致"
  const pw = password.value.trim()
  if (!pw) return showToast('请输入密码')
  loading.value = true
  try {
    if (!initialized.value) {
      if (pw.length < 6) return showToast('密码至少 6 位')
      if (pw !== confirm.value.trim()) return showToast('两次输入的密码不一致')
      await setupPassword({ password: pw })
    } else {
      await loginPassword({ password: pw })
    }
    hapticFeedback()
    router.replace('/')
  } catch (e) {
    // 具体原因已由拦截器 toast（密码错误/频繁锁定等）
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--canvas);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.login-box {
  width: 100%;
  max-width: 360px;
  text-align: center;
}
.login-icon {
  width: 64px;
  height: 64px;
  border-radius: 14px;
}
.login-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.4px;
  color: var(--ink);
  margin-top: 16px;
}
.login-sub {
  font-size: 13px;
  color: var(--ink-subtle);
  margin: 8px 0 24px;
}
/* inset 单元组自带左右缩进,与整体留白对齐 */
.login-fields {
  margin: 0;
  border-radius: 8px;
}
.login-btn {
  margin-top: 16px;
}
.login-tip {
  font-size: 12px;
  color: var(--ink-tertiary);
  margin-top: 16px;
  line-height: 1.6;
}
</style>
