// 金额滚动动效：分值变化时从「当前呈现值」续滚到新目标（而非每次从 0 重滚），
// 新一轮滚动开始前先停掉上一段动画，保证任意时刻可中断、无跳变
import { ref, watch, type Ref } from 'vue'
import { animate } from 'motion-v'
import { fenToYuan } from './money'

// 系统开启了「减弱动态」时跳过滚动直接跳终值
const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// 传入分值的响应式引用，返回滚动中的"元"字符串（两位小数）
export function useAnimatedYuan(
  fen: Ref<number | string | null | undefined>,
  duration = 0.8
) {
  const display = ref('0.00')

  // 当前数值状态：作为下一段滚动的起点（呈现值优先原则）
  let current = 0
  // 上一段动画的控制器，用于新目标到来时中断
  let controls: ReturnType<typeof animate> | null = null

  watch(
    () => fen.value,
    (target) => {
      const to = Number(target) || 0
      controls?.stop()

      if (prefersReducedMotion()) {
        current = to
        display.value = fenToYuan(to)
        return
      }

      controls = animate(current, to, {
        duration,
        ease: 'easeOut',
        onUpdate: (latest: number) => {
          current = latest
          display.value = fenToYuan(Math.round(latest))
        }
      })
    },
    { immediate: true }
  )

  return display
}
