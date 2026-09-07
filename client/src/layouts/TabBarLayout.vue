<template>
  <div class="tab-layout">
    <!-- 底部 Tab 间平级切换：快速交叉淡入（方向性推入只用于层级跳转，见 App.vue） -->
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <!-- safe-area-inset-bottom：全面屏底部预留 Home 指示条高度 -->
    <van-tabbar v-model="active" safe-area-inset-bottom active-color="#828fff" @change="onTabChange">
      <van-tabbar-item icon="wap-home-o">工作台</van-tabbar-item>
      <van-tabbar-item icon="orders-o">工单</van-tabbar-item>
      <van-tabbar-item icon="contact-o">客户</van-tabbar-item>
      <van-tabbar-item icon="bell">提醒</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 底部导航激活索引
const active = ref(0)
// tab 对应的路径
const tabPaths = ['/', '/orders', '/customers', '/reminders']

// 根据当前路由同步激活状态（精确匹配，避免 / 匹配所有路径）
watch(() => route.path, (path) => {
  const idx = tabPaths.findIndex(p => path === p)
  active.value = idx >= 0 ? idx : 0
}, { immediate: true })

// 点击 tab 时跳转
const onTabChange = (index: number) => {
  const targetPath = tabPaths[index]
  if (targetPath && route.path !== targetPath) {
    router.push(targetPath)
  }
}
</script>

<style scoped>
.tab-layout {
  min-height: 100vh;
  /* 容器留白随 tabbar 实际高度（50px + 底部安全区）联动 */
  padding-bottom: calc(50px + env(safe-area-inset-bottom));
}
</style>
