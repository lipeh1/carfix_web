import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// PWA 支持：构建时生成 Service Worker，实现「添加到桌面」独立应用形态
// 开发模式禁用（SW 缓存会干扰热更新），生产环境自动更新（skipWaiting + clientsClaim）
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development'
})

const nextConfig: NextConfig = {
  // 容器化部署（腾讯云 CloudBase 云托管）必须开启：
  // 生成 .next/standalone 自包含产物，镜像里不再需要完整 node_modules
  // 对 Vercel 无影响（Vercel 忽略该选项）
  output: 'standalone'
}

export default withSerwist(nextConfig)
