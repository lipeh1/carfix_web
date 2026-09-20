import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { ConfirmProvider } from '@/components/mobile/ConfirmProvider'
import './globals.css'

export const metadata: Metadata = {
  title: '汽修管理系统',
  description: '汽修门店接车、维修、结算、交车全流程管理',
  // 阻止移动浏览器对数字/车牌自动识别为电话号（接车页常见误触）
  formatDetection: { telephone: false }
}

// theme-color 跟随系统深浅色（替代旧版 App.vue 的运行时 meta 同步）
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#010102' },
    { media: '(prefers-color-scheme: light)', color: '#fbfbfc' }
  ]
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ConfirmProvider>
          {children}
          <Toaster />
        </ConfirmProvider>
      </body>
    </html>
  )
}
