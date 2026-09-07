<template>
  <!-- 深色主题由 ConfigProvider 全局下发（Linear 深色风格，见 AGENTS.md 第 6 节） -->
  <van-config-provider theme="dark">
    <!-- reducedMotion="user"：系统开启「减弱动态」时，motion 动画自动退化为淡入/跳变 -->
    <MotionConfig reduced-motion="user">
      <!-- 页面切换过渡：out-in 避免新旧页面固定定位元素重叠 -->
      <router-view v-slot="{ Component }">
        <transition :name="transitionName" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </MotionConfig>
  </van-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MotionConfig } from 'motion-v'

const router = useRouter()

// 按导航方向挑选过渡：进更深层级 push（右进）、返回 pop（原路退回）、平级 fade（交叉淡入）
const transitionName = ref('fade')
router.beforeEach((to, from) => {
  // 详情类路由带 transition: 'push' 标记视为更深一层
  const depth = (r: { meta?: { transition?: string } }) => (r.meta?.transition === 'push' ? 1 : 0)
  const d = depth(to) - depth(from)
  transitionName.value = d > 0 ? 'push' : d < 0 ? 'pop' : 'fade'
})
</script>
