'use client'

// 数字滚动动效：分值变化时从「当前呈现值」续滚到新目标（而非每次从 0 重滚），
// 新一轮滚动开始前先停掉上一段动画，保证任意时刻可中断、无跳变
// （自旧 client/src/utils/countup.ts 移植为 React hook）
import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
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
  // 上一段动画的控制器，用于新目标到来时中断
  const controlsRef = useRef<ReturnType<typeof animate> | null>(null)

  useEffect(() => {
    const to = Number(fen) || 0
    controlsRef.current?.stop()

    if (prefersReducedMotion()) {
      currentRef.current = to
      setDisplay(fenToYuan(to))
      return
    }

    controlsRef.current = animate(currentRef.current, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest: number) => {
        currentRef.current = latest
        setDisplay(fenToYuan(Math.round(latest)))
      }
    })
    return () => controlsRef.current?.stop()
  }, [fen, duration])

  return display
}
