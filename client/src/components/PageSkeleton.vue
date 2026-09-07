<!-- 详情页加载骨架:首卡(标题/车牌+徽章) + 若干信息卡占位,数据到达前避免空白干等 -->
<template>
  <div class="page-content">
    <!-- 首卡:标题行 + 元信息行 + 右侧状态徽章位 -->
    <div class="card">
      <div class="flex-between">
        <div style="flex: 1">
          <div class="sk sk-line" style="width: 42%"></div>
          <div class="sk sk-sm" style="width: 62%; margin-top: 10px"></div>
        </div>
        <div class="sk sk-pill"></div>
      </div>
    </div>
    <!-- 信息卡:小标题 + 两行内容(第二行窄),数量按页面信息量配置 -->
    <div class="card" v-for="n in cards" :key="n">
      <div class="sk sk-sm" style="width: 26%"></div>
      <div class="sk sk-line" style="width: 76%; margin-top: 12px"></div>
      <div class="sk sk-sm" style="width: 52%; margin-top: 8px"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// cards:首卡之外的信息卡数量
withDefaults(defineProps<{ cards?: number }>(), { cards: 2 })
</script>
