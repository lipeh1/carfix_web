'use client'

// 底栏透镜：按压鼓起、拖动拉伸，主体折射背景，窄边缘微折射并保持图标轮廓清晰
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValueEvent, useSpring, useTransform, type MotionStyle, type MotionValue } from 'motion/react'

const REFRACTION = 32

// 只在尺寸变化时生成胶囊的位移贴图，拖动期间复用，避免逐帧读取页面或重画画布
function createLensMap(width: number, height: number) {
  const canvas = document.createElement('canvas')
  const density = 2
  canvas.width = Math.ceil(width * density)
  canvas.height = Math.ceil(height * density)
  const context = canvas.getContext('2d')
  if (!context) return ''
  const image = context.createImageData(canvas.width, canvas.height)
  const radius = height / 2
  const stem = Math.max(0, width / 2 - radius)

  for (let row = 0; row < canvas.height; row++) {
    for (let column = 0; column < canvas.width; column++) {
      const px = (column + 0.5) / density - width / 2
      const py = (row + 0.5) / density - height / 2
      const nx = px - Math.max(-stem, Math.min(stem, px))
      const distance = Math.hypot(nx, py)
      const edge = Math.min(1, distance / radius)
      const bend = 10 * edge ** 4
      // 中部轻微放大背景，弧形边缘折射更强；导航文字由独立上层绘制
      const dx = distance <= radius ? -px * 0.12 - nx / Math.max(distance, 1) * bend : 0
      const dy = distance <= radius ? -py * 0.12 - py / Math.max(distance, 1) * bend : 0
      const offset = (row * canvas.width + column) * 4
      image.data[offset] = Math.round(255 * Math.max(0, Math.min(1, 0.5 + dx / REFRACTION)))
      image.data[offset + 1] = Math.round(255 * Math.max(0, Math.min(1, 0.5 + dy / REFRACTION)))
      image.data[offset + 2] = 128
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}

interface TabLensMotion {
  position: MotionValue<number>
  pressure: MotionValue<number>
  stretch: MotionValue<number>
}

// 前缘先跟手、后缘稍后追上，用同一组运动值驱动镜片和图标，避免各自缩放造成脱节
export function useTabLensMotion(position: MotionValue<number>, contact: MotionValue<number>): TabLensMotion {
  const front = useSpring(position, { stiffness: 1050, damping: 54, mass: 0.65 })
  const rear = useSpring(position, { stiffness: 420, damping: 34, mass: 0.85 })
  const pressure = useSpring(contact, { stiffness: 460, damping: 32, mass: 0.85 })
  const center = useTransform([front, rear], ([leading, trailing]) => Number(leading) * 0.8 + Number(trailing) * 0.2)
  const stretch = useTransform([front, rear], ([leading, trailing]) => Math.max(-0.38, Math.min(0.38, Number(leading) - Number(trailing))))
  return { position: center, pressure, stretch }
}

interface LensProps {
  movement: TabLensMotion
  count: number
}

export default function TabGlassLens({ movement, count }: LensProps) {
  const { position, pressure, stretch } = movement
  const filterId = `tab-lens-${useId().replace(/:/g, '')}`
  const rimId = `${filterId}-rim`
  const lensRef = useRef<HTMLSpanElement>(null)
  const [map, setMap] = useState<{ href: string; width: number; height: number } | null>(null)
  const redRef = useRef<SVGFEDisplacementMapElement>(null)
  const greenRef = useRef<SVGFEDisplacementMapElement>(null)
  const blueRef = useRef<SVGFEDisplacementMapElement>(null)
  const x = useTransform(position, value => `${value * 100}%`)
  const scaleX = useTransform([pressure, stretch], ([pressed, lag]) =>
    1 + Math.max(0, Math.min(1, Number(pressed))) * 0.34 + Math.abs(Number(lag)) * 0.3)
  const scaleY = useTransform([pressure, stretch], ([pressed, lag]) =>
    1 + Math.max(0, Math.min(1, Number(pressed))) * 0.2 - Math.abs(Number(lag)) * 0.1)
  // 抵消横向拉伸对端部圆弧的挤压，镜片保持圆润端头而不是整块椭圆被拉长
  const borderRadius = useTransform([scaleX, scaleY], ([widthScale, heightScale]) => `${29 * Number(heightScale) / Number(widthScale)}px / 29px`)
  const lightAngle = useTransform(stretch, value => `${115 + value * 80}deg`)
  // 两端的玻璃向栏内鼓起，避免挤出窄屏边缘
  const originX = useTransform(position, value => Math.max(0, Math.min(1, value / (count - 1))))

  // 静止时使用较薄的玻璃，按住时增加背景折射厚度
  useMotionValueEvent(pressure, 'change', value => {
    const strength = 0.16 + Math.max(0, Math.min(1, value)) * 0.84
    redRef.current?.setAttribute('scale', String((REFRACTION + 2) * strength))
    greenRef.current?.setAttribute('scale', String(REFRACTION * strength))
    blueRef.current?.setAttribute('scale', String((REFRACTION - 2) * strength))
  })

  useEffect(() => {
    const lens = lensRef.current
    if (!lens) return
    const observer = new ResizeObserver(entries => {
      const size = entries[0].borderBoxSize?.[0]
      const width = size?.inlineSize ?? lens.offsetWidth
      const height = size?.blockSize ?? lens.offsetHeight
      if (width > 0 && height > 0) setMap({ href: createLensMap(width, height), width, height })
    })
    observer.observe(lens)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <svg className="tab-lens-filter" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} filterUnits="userSpaceOnUse" x="0" y="0" width={map?.width} height={map?.height} colorInterpolationFilters="sRGB">
            <feImage href={map?.href} x="0" y="0" width={map?.width} height={map?.height} preserveAspectRatio="none" result="lens-map" />
            {/* 三个通道仅错开一个像素左右，模拟玻璃弧边的轻微色散 */}
            <feDisplacementMap ref={redRef} in="SourceGraphic" in2="lens-map" scale={(REFRACTION + 2) * 0.16} xChannelSelector="R" yChannelSelector="G" result="red-shift" />
            <feColorMatrix in="red-shift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feDisplacementMap ref={greenRef} in="SourceGraphic" in2="lens-map" scale={REFRACTION * 0.16} xChannelSelector="R" yChannelSelector="G" result="green-shift" />
            <feColorMatrix in="green-shift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            <feDisplacementMap ref={blueRef} in="SourceGraphic" in2="lens-map" scale={(REFRACTION - 2) * 0.16} xChannelSelector="R" yChannelSelector="G" result="blue-shift" />
            <feColorMatrix in="blue-shift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="red-green" />
            <feBlend in="red-green" in2="blue" mode="screen" />
          </filter>
          {/* 窄边缘使用同通道微折射，最大采样偏移不足一像素，不产生图标彩边 */}
          <filter id={rimId} filterUnits="userSpaceOnUse" x="0" y="0" width={map?.width} height={map?.height} colorInterpolationFilters="sRGB">
            <feImage href={map?.href} x="0" y="0" width={map?.width} height={map?.height} preserveAspectRatio="none" result="rim-map" />
            <feDisplacementMap in="SourceGraphic" in2="rim-map" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <motion.span className="workspace-nav-indicator" aria-hidden="true" style={{ x }}>
        <motion.span
          ref={lensRef}
          className="tab-glass-lens"
          data-optics={!!map || undefined}
          style={{ scaleX, scaleY, originX, borderRadius, '--lens-pressure': pressure, '--lens-light-angle': lightAngle, '--lens-filter': `url("#${filterId}")` } as MotionStyle}
        />
      </motion.span>
      <motion.span className="workspace-nav-refraction" aria-hidden="true" style={{ x }}>
        <motion.span
          className="tab-glass-rim"
          data-optics={!!map || undefined}
          style={{ scaleX, scaleY, originX, borderRadius, '--rim-filter': `url("#${rimId}")` } as MotionStyle}
        />
      </motion.span>
    </>
  )
}

// 图标沿用原始矢量轮廓，只做等比放大，不斜切、不分离颜色通道，也不缩放标签
export function TabGlassIcon({ movement, index, children }: Omit<LensProps, 'count'> & { index: number; children: ReactNode }) {
  const { position, pressure } = movement
  const scale = useTransform([position, pressure], ([value, pressed]) => {
    const proximity = Math.max(0, 1 - Math.abs(Number(value) - index))
    // 平滑交接相邻图标的放大量，镜片滑过选项边界时不会突然跳大
    const focus = proximity * proximity * (3 - 2 * proximity)
    return 1 + focus * Math.max(0, Math.min(1, Number(pressed))) * 0.28
  })
  // 放大时向上让出新增高度，保持图标底边和标签间距不变
  const y = useTransform(scale, value => -(value - 1) * 10)
  return <motion.span className="workspace-nav-icon" style={{ scale, y }}>{children}</motion.span>
}
