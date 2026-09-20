import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// PWA 支持：构建时生成 Service Worker，实现「添加到桌面」独立应用形态
// 开发模式禁用（SW 缓存会干扰热更新），生产环境自动更新（skipWaiting + clientsClaim）
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development'
})

const nextConfig: NextConfig = {}

export default withSerwist(nextConfig)
