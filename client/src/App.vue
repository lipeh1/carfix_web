<template>
  <!-- 主题跟随系统深浅色:颜色令牌在 global.css 按 prefers-color-scheme 切换 -->
  <van-config-provider :theme="isDark ? 'dark' : 'light'">
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { MotionConfig } from 'motion-v'

const router = useRouter()

// ===== 深浅色跟随系统 =====
const schemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
const isDark = ref(schemeMedia.matches)

// 状态栏 / 浏览器标题栏颜色随主题同步（manifest 的 theme_color 只影响安装时外观，运行时以此为准）
const syncThemeColor = () => {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark.value ? '#010102' : '#fbfbfc')
}

const onSchemeChange = (e: MediaQueryListEvent) => {
  isDark.value = e.matches
  syncThemeColor()
}

onMounted(() => {
  // 旧版 Safari 只支持 addListener,做能力兼容
  if (typeof schemeMedia.addEventListener === 'function') {
    schemeMedia.addEventListener('change', onSchemeChange)
  } else {
    (schemeMedia as any).addListener?.(onSchemeChange)
  }
  syncThemeColor()
})

onUnmounted(() => {
  if (typeof schemeMedia.removeEventListener === 'function') {
    schemeMedia.removeEventListener('change', onSchemeChange)
  } else {
    (schemeMedia as any).removeListener?.(onSchemeChange)
  }
})

// 按导航方向挑选过渡：进更深层级 push（右进）、返回 pop（原路退回）、平级 fade（交叉淡入）
const transitionName = ref('fade')
router.beforeEach((to, from) => {
  // 详情类路由带 transition: 'push' 标记视为更深一层
  const depth = (r: { meta?: { transition?: string } }) => (r.meta?.transition === 'push' ? 1 : 0)
  const d = depth(to) - depth(from)
  transitionName.value = d > 0 ? 'push' : d < 0 ? 'pop' : 'fade'
})
</script>
