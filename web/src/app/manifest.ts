// PWA manifest（与旧 vite-plugin-pwa manifest 保持一致）
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '汽修管理系统',
    short_name: '汽修管理',
    description: '汽修门店接车、维修、结算、交车全流程管理',
    lang: 'zh-CN',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#010102',
    background_color: '#010102',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
}
