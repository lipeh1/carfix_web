<!-- 添加到桌面安装引导卡片：按运行环境（微信/iOS Safari/安卓浏览器）给出对应的安装路径 -->
<template>
  <div class="card install-card" v-if="visible">
    <img src="/icons/icon-192.png" class="install-icon" alt="" />
    <div class="install-info">
      <div class="install-title">安装到手机桌面</div>
      <div class="text-muted install-tip">{{ tip }}</div>
    </div>
    <van-icon name="cross" class="install-close" @click="dismiss" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 环境识别（微信需单独处理：iOS 微信内无法直接添加到桌面）
const ua = navigator.userAgent
const isWeChat = /MicroMessenger/i.test(ua)
const isIOS =
  /iPhone|iPad|iPod/i.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isAndroid = /Android/i.test(ua)

// 是否已处于独立应用模式（从桌面图标打开），是则无需再引导
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true

// 用户主动关闭过引导则不再出现
const dismissed = localStorage.getItem('pwa-guide-dismissed') === '1'

const visible = ref(false)

// 各环境操作指引文案
const tip = computed(() => {
  if (isWeChat && isIOS) return '微信内无法直接安装：点右上角「···」→ 在 Safari 打开，再按 Safari 步骤操作'
  if (isWeChat) return '点右上角「···」→ 添加到桌面'
  if (isIOS) return '点底部「分享」按钮 → 添加到主屏幕'
  return '点浏览器「菜单」→ 安装应用 / 添加到主屏幕'
})

onMounted(() => {
  // 仅在移动端环境、非独立模式、未关闭过时显示
  if (isStandalone || dismissed) return
  if (isWeChat || isIOS || isAndroid) visible.value = true
})

const dismiss = () => {
  visible.value = false
  localStorage.setItem('pwa-guide-dismissed', '1')
}
</script>

<style scoped>
.install-card {
  display: flex;
  align-items: center;
  gap: 12px;
}
.install-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}
.install-info {
  flex: 1;
}
.install-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.install-tip {
  margin-top: 4px;
  line-height: 1.5;
}
.install-close {
  color: var(--ink-tertiary);
  font-size: 18px;
  padding: 4px;
  cursor: pointer;
}
</style>
