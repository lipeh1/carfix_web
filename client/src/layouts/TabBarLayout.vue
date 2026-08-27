<template>
  <div class="tab-layout">
    <!-- 底部 Tab 间的页面切换也走统一的淡入过渡 -->
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <van-tabbar v-model="active" active-color="#828fff" @change="onTabChange">
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
  padding-bottom: 50px;
}
</style>
