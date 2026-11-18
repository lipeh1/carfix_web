// 应用根布局：加载自托管字体、全局视觉令牌与共用交互容器
import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { ConfirmProvider } from '@/components/mobile/ConfirmProvider'
// 字体随应用打包，部署和访问均不依赖外部字体服务
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/noto-serif-sc'
import './globals.css'
import './workspace.css'

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
    { media: '(prefers-color-scheme: dark)', color: '#202427' },
    { media: '(prefers-color-scheme: light)', color: '#edf1f3' }
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
