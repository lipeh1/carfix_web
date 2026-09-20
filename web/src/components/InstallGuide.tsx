'use client'

// 添加到桌面安装引导卡片：按运行环境（微信/iOS Safari/安卓浏览器）给出对应的安装路径
// （自旧 client/src/components/InstallGuide.vue 移植）
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// beforeinstallprompt 事件的非标准字段
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallGuide() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null)
  // 各环境操作指引文案（原生安装可用时被按钮替代），SSR 期无 navigator 先给通用文案
  const [tip, setTip] = useState('点浏览器「菜单」→ 安装应用 / 添加到主屏幕')

  useEffect(() => {
    // 环境识别（微信需单独处理：iOS 微信内无法直接添加到桌面）
    const ua = navigator.userAgent
    const isWeChat = /MicroMessenger/i.test(ua)
    const isIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/i.test(ua)

    // 是否已处于独立应用模式（从桌面图标打开），是则无需再引导
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true

    // 用户主动关闭过引导则不再出现
    const dismissed = localStorage.getItem('pwa-guide-dismissed') === '1'

    // 按环境设置指引文案
    if (isWeChat && isIOS) setTip('微信内无法直接安装：点右上角「···」→ 在 Safari 打开，再按 Safari 步骤操作')
    else if (isWeChat) setTip('点右上角「···」→ 添加到桌面')
    else if (isIOS) setTip('点底部「分享」按钮 → 添加到主屏幕')

    // 浏览器原生安装事件（安卓 Chrome/Edge 支持；微信与 iOS Safari 不会触发）
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    // 仅在移动端环境、非独立模式、未关闭过时显示
    if (!isStandalone && !dismissed && (isWeChat || isIOS || isAndroid)) setVisible(true)

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  // 调起浏览器的原生安装弹窗
  const installNow = async () => {
    const prompt = deferredPrompt
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      localStorage.setItem('pwa-guide-dismissed', '1')
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem('pwa-guide-dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="card mb-3 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>安装到手机桌面</div>
        <div className="text-muted mt-1 leading-normal">{tip}</div>
      </div>
      {deferredPrompt ? (
        <Button size="sm" onClick={installNow}>立即安装</Button>
      ) : (
        <button
          type="button"
          aria-label="关闭"
          className="pressable p-1"
          style={{ color: 'var(--ink-tertiary)' }}
          onClick={dismiss}
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}
