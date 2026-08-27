// 金额滚动动效：基于 motion-v 的 animate 让分值从 0 滚动到目标值，滚动过程换算为"元"展示
import { ref, watch, type Ref } from 'vue'
import { animate } from 'motion-v'
import { fenToYuan } from './money'

// 传入分值的响应式引用，返回滚动中的"元"字符串（两位小数）
export function useAnimatedYuan(
  fen: Ref<number | string | null | undefined>,
  duration = 0.8
) {
  const display = ref('0.00')

  watch(
    () => fen.value,
    (target) => {
      const to = Number(target) || 0
      animate(0, to, {
        duration,
        ease: 'easeOut',
        onUpdate: (latest: number) => {
          display.value = fenToYuan(Math.round(latest))
        }
      })
    },
    { immediate: true }
  )

  return display
}
