<template>
  <div class="tab-layout">
    <router-view />
    <van-tabbar v-model="active" route active-color="#1989fa">
      <van-tabbar-item to="/" icon="wap-home-o">工作台</van-tabbar-item>
      <van-tabbar-item to="/orders" icon="orders-o">工单</van-tabbar-item>
      <van-tabbar-item to="/customers" icon="contact-o">客户</van-tabbar-item>
      <van-tabbar-item to="/reminders" icon="bell-o">提醒</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const active = ref(0)
</script>

<style scoped>
.tab-layout {
  min-height: 100vh;
  padding-bottom: 50px;
}
</style>
