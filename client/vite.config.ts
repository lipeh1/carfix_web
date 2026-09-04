import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()]
    }),
    // PWA 支持：构建时生成 manifest 与 Service Worker，实现"添加到桌面"独立应用形态
    VitePWA({
      // 自动更新：新版本后台静默拉取，重开应用即生效，避免用户停留在旧缓存
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
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
      },
      workbox: {
        // SPA 路由回退：所有导航请求离线时回落到 index.html
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8850,
    proxy: {
      '/api': {
        target: 'http://localhost:8851',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8851',
        changeOrigin: true
      }
    }
  }
})
