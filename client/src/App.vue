<template>
  <!-- 深色主题由 ConfigProvider 全局下发（Linear 深色风格，见 AGENTS.md 第 6 节） -->
  <van-config-provider theme="dark">
    <!-- 页面切换过渡：out-in 避免新旧页面固定定位元素重叠 -->
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </van-config-provider>
</template>

<script setup lang="ts">
</script>
