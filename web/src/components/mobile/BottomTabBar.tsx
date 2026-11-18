'use client'

// 手机底栏支持点击与拖动选项，桌面复用相同入口显示紧凑侧栏
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ClipboardList, Contact, Bell, Wrench } from 'lucide-react'
import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import TabGlassLens, { TabGlassIcon, useTabLensMotion } from './TabGlassLens'

const TABS = [
  { path: '/', label: '工作台', icon: Home },
  { path: '/orders', label: '工单', icon: ClipboardList },
  { path: '/customers', label: '客户', icon: Contact },
  { path: '/reminders', label: '提醒', icon: Bell }
] as const

interface TabGesture {
  pointerId: number
  startX: number
  startY: number
  left: number
  width: number
  grabOffset: number
  dragging: boolean
}

const clampPosition = (position: number) => Math.max(0, Math.min(TABS.length - 1, position))

export default function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  // 精确匹配当前激活 tab（避免 / 匹配所有路径）
  const activePath = TABS.find(t => t.path === pathname)?.path ?? null
  const activeIndex = TABS.findIndex(t => t.path === activePath)
  const navRef = useRef<HTMLElement>(null)
  const gestureRef = useRef<TabGesture | null>(null)
  const suppressClickRef = useRef(false)
  const [preview, setPreview] = useState<{ path: string; index: number; dragging: boolean } | null>(null)
  // 以选项宽度为单位记录位置，窄屏与横竖屏切换都沿用同一套吸附位置
  const position = useMotionValue(activeIndex)
  const contact = useMotionValue(0)
  const lensMovement = useTabLensMotion(position, contact)
  const currentPreview = preview?.path === pathname ? preview : null
  const selectedIndex = currentPreview?.index ?? activeIndex
  const dragging = currentPreview?.dragging ?? false

  function snapTo(index: number) {
    position.stop()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    animate(position, index, reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 })
  }

  useEffect(() => {
    // 前进、后退或点击切页后，以真实路由为准；外部切页同时取消未结束的手势
    const gesture = gestureRef.current
    gestureRef.current = null
    contact.set(0)
    if (gesture && navRef.current?.hasPointerCapture(gesture.pointerId)) {
      navRef.current.releasePointerCapture(gesture.pointerId)
    }
    position.stop()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = animate(position, activeIndex, reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 })
    return () => animation.stop()
  }, [activeIndex, position, contact, reducedMotion])

  useEffect(() => {
    // 失焦或尺寸变化时丢弃旧坐标，防止松手后误跳转
    function cancelGesture() {
      const gesture = gestureRef.current
      if (!gesture) return
      gestureRef.current = null
      contact.set(0)
      suppressClickRef.current = true
      setPreview(null)
      if (navRef.current?.hasPointerCapture(gesture.pointerId)) {
        navRef.current.releasePointerCapture(gesture.pointerId)
      }
      position.stop()
      position.set(activeIndex)
    }
    window.addEventListener('blur', cancelGesture)
    window.addEventListener('resize', cancelGesture)
    return () => {
      window.removeEventListener('blur', cancelGesture)
      window.removeEventListener('resize', cancelGesture)
    }
  }, [activeIndex, position, contact])

  function startGesture(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || gestureRef.current) return
    suppressClickRef.current = false
    if (activeIndex < 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      !window.matchMedia('(max-width: 1023px)').matches) return
    const nav = event.currentTarget
    const bounds = nav.getBoundingClientRect()
    const style = getComputedStyle(nav)
    const insetLeft = parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
    const insetRight = parseFloat(style.borderRightWidth) + parseFloat(style.paddingRight)
    const left = bounds.left + insetLeft
    const width = (bounds.width - insetLeft - insetRight) / TABS.length
    const indicatorLeft = left + position.get() * width
    // 抓住当前底片时保留手指落点；从其他选项拖动则让底片跟随手指中心
    const grabOffset = event.clientX >= indicatorLeft && event.clientX <= indicatorLeft + width
      ? event.clientX - indicatorLeft : width / 2
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left, width, grabOffset, dragging: false }
    contact.set(1)
  }

  function moveGesture(event: PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (!gesture.dragging) {
      const dx = Math.abs(event.clientX - gesture.startX)
      const dy = Math.abs(event.clientY - gesture.startY)
      // 轻微手抖仍按点击处理；纵向手势交给浏览器滚动
      if (Math.max(dx, dy) < 6) return
      if (dy > dx) {
        gestureRef.current = null
        contact.set(0)
        suppressClickRef.current = true
        return
      }
      gesture.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      position.stop()
    }
    event.preventDefault()
    const next = clampPosition((event.clientX - gesture.grabOffset - gesture.left) / gesture.width)
    position.set(next)
    const index = Math.round(next)
    setPreview(previous => previous?.path === pathname && previous.index === index && previous.dragging
      ? previous : { path: pathname, index, dragging: true })
  }

  function finishGesture(event: PointerEvent<HTMLElement>, cancelled = false) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    contact.set(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!gesture.dragging) return
    // 拖动后的兼容 click 不能再次触发起点链接，取消手势也不能切页
    suppressClickRef.current = true
    const bounds = event.currentTarget.getBoundingClientRect()
    const outside = event.clientY < bounds.top - 24 || event.clientY > bounds.bottom + 24
    if (cancelled || outside) {
      setPreview(null)
      snapTo(activeIndex)
      return
    }
    const index = Math.round(clampPosition((event.clientX - gesture.grabOffset - gesture.left) / gesture.width))
    setPreview({ path: pathname, index, dragging: false })
    snapTo(index)
    if (TABS[index].path !== pathname) router.push(TABS[index].path)
  }

  return (
    <nav
      ref={navRef}
      className="workspace-nav"
      aria-label="主导航"
      data-dragging={dragging || undefined}
      style={{ '--tab-count': TABS.length, '--active-tab': selectedIndex } as CSSProperties}
      onPointerDown={startGesture}
      onPointerMove={moveGesture}
      onPointerUp={event => finishGesture(event)}
      onPointerCancel={event => finishGesture(event, true)}
      onLostPointerCapture={event => {
        // 触摸从链接的隐式捕获转交给底栏时，链接会冒泡丢失事件，不能误判为取消
        if (event.target === event.currentTarget) finishGesture(event, true)
      }}
      onDragStart={event => {
        if (gestureRef.current) event.preventDefault()
      }}
      onClickCapture={event => {
        if (suppressClickRef.current && event.detail > 0) {
          event.preventDefault()
          event.stopPropagation()
          suppressClickRef.current = false
        }
      }}
    >
      <div className="workspace-brand"><Wrench size={20} strokeWidth={1.7} /><span>汽修管理系统</span></div>
      {/* 镜片主体在内容下方，只有窄边缘覆盖轻微折射，中心图标保持完整轮廓 */}
      {activeIndex >= 0 && <TabGlassLens movement={lensMovement} count={TABS.length} />}
      {TABS.map((tab, index) => {
        const active = tab.path === activePath
        const Icon = tab.icon
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="workspace-nav-link pressable"
            aria-current={active ? 'page' : undefined}
            data-selected={index === selectedIndex || undefined}
          >
            <span className="workspace-nav-content">
              <TabGlassIcon movement={lensMovement} index={index}>
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              </TabGlassIcon>
              <span>{tab.label}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
