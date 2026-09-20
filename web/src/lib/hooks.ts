'use client'

// 数字滚动动效：分值变化时从「当前呈现值」续滚到新目标（而非每次从 0 重滚），
// 新一轮滚动开始前先取消上一段动画，保证任意时刻可中断、无跳变
// （自旧 client/src/utils/countup.ts 移植为 React hook，rAF 手写补间不再依赖 motion）
import { useEffect, useRef, useState } from 'react'
import { fenToYuan } from './money'

// 系统开启了「减弱动态」时跳过滚动直接跳终值
const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// 传入分值，返回滚动中的「元」字符串（两位小数）
export function useAnimatedYuan(
  fen: number | string | null | undefined,
  duration = 0.8
): string {
  const [display, setDisplay] = useState('0.00')
  // 当前数值状态：作为下一段滚动的起点（呈现值优先原则）
  const currentRef = useRef(0)

  useEffect(() => {
    const to = Number(fen) || 0
    const from = currentRef.current

    if (prefersReducedMotion() || from === to) {
      currentRef.current = to
      setDisplay(fenToYuan(to))
      return
    }

    const durationMs = duration * 1000
    const start = performance.now()
    let raf = 0
    let watchdog = 0
    let settled = false
    let firstFrame = false

    const finish = () => {
      if (settled) return
      settled = true
      currentRef.current = to
      setDisplay(fenToYuan(to))
    }

    // easeOutCubic 补间：从呈现值续滚
    const tick = (now: number) => {
      if (settled) return
      firstFrame = true
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (to - from) * eased
      currentRef.current = v
      setDisplay(fenToYuan(Math.round(v)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else finish()
    }

    raf = requestAnimationFrame(tick)
    // 看门狗：个别内嵌 WebView 合成器不绘制时 rAF 会被挂起（回调永不触发），
    // 动画是增强、终值是底线——首帧 300ms 未到则放弃动画直接落终值
    watchdog = window.setTimeout(() => {
      if (!firstFrame) {
        cancelAnimationFrame(raf)
        finish()
      }
    }, 300)

    return () => {
      settled = true
      cancelAnimationFrame(raf)
      clearTimeout(watchdog)
    }
  }, [fen, duration])

  return display
}
