// 店铺名称：全局设置存服务端 settings 表（跨设备一致），报价单长图页眉取用
// 接口封装在 lib/api.ts；此处提供常量与模块级缓存（报价图生成高频取用，避免每次请求）
import { getShopName } from './api'

export const DEFAULT_SHOP_NAME = '汽修服务中心'
export const SHOP_NAME_MAX_LEN = 12

// 缓存未命中时请求服务端；失败不缓存（回退默认名，下次再试）
let cached: string | null = null

// 取当前生效店名（未设置/接口失败返回默认名，避免页眉空白）
export async function resolveShopName(): Promise<string> {
  if (cached !== null) return cached
  let name = DEFAULT_SHOP_NAME
  try {
    const res = await getShopName()
    name = res.shopName?.trim() || DEFAULT_SHOP_NAME
  } catch {
    // 失败不缓存，下次再试
    return name
  }
  cached = name
  return name
}

// 保存成功后刷新缓存，报价图立即用新名
export function setShopNameCache(name: string) {
  cached = name.trim() || DEFAULT_SHOP_NAME
}
