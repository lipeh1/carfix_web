<template>
  <!-- 深色主题由 ConfigProvider 全局下发（Linear 深色风格，见 AGENTS.md 第 6 节） -->
  <van-config-provider theme="dark">
    <router-view />
  </van-config-provider>
</template>

<script setup lang="ts">
</script>
