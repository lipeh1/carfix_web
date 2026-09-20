// Service Worker：预缓存应用骨架 + 运行时缓存策略（对应旧 vite-plugin-pwa 的 workbox 配置）
// 自动更新：新版本后台静默拉取，重开应用即生效，避免用户停留在旧缓存
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry } from 'serwist'
import { Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  // Serwist 构建时注入的预缓存清单
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        // 导航请求离线时回落到首页（SPA 形态的应用外壳）
        url: '/',
        matcher({ request }) {
          return request.destination === 'document'
        }
      }
    ]
  }
})

serwist.addEventListeners()
