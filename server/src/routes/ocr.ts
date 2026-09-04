// 百度 OCR 识别路由：行驶证识别 / 车牌识别
// 密钥从环境变量读取（server/.env）：
//   BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY
// 未配置密钥时返回明确业务错误（503），前端据此回退手输，不阻塞接车
import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// access_token 内存缓存：百度签发的 token 有效期约 30 天，避免每次请求都重新鉴权
let tokenCache: { token: string; expiresAt: number } | null = null

const getConfig = () => ({
  apiKey: process.env.BAIDU_OCR_API_KEY || '',
  secretKey: process.env.BAIDU_OCR_SECRET_KEY || ''
})

// 获取（或复用缓存的）百度 access_token
async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`
  let data: any
  try {
    const res = await fetch(url, { method: 'POST' })
    data = await res.json()
  } catch (e) {
    throw new AppError('识别服务无法连接，请稍后重试或改用手动输入', 502)
  }
  if (!data?.access_token) {
    throw new AppError('识别服务鉴权失败，请检查 API Key / Secret Key 配置', 502)
  }
  // 提前 1 小时视为过期，避免边界时刻请求失败
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in as number) - 3600) * 1000
  }
  return data.access_token as string
}

// 调用百度 OCR 通用入口，image 为不含 data: 前缀的 base64
async function baiduOcr(endpoint: string, imageBase64: string): Promise<any> {
  const { apiKey, secretKey } = getConfig()
  if (!apiKey || !secretKey) {
    throw new AppError('识别服务未配置：请在 server/.env 填入 BAIDU_OCR_API_KEY 与 BAIDU_OCR_SECRET_KEY', 503)
  }
  const token = await getAccessToken(apiKey, secretKey)
  let data: any
  try {
    const res = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/${endpoint}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(imageBase64)}`
    })
    data = await res.json()
  } catch (e) {
    throw new AppError('识别服务无法连接，请稍后重试或改用手动输入', 502)
  }
  // 百度业务错误（额度耗尽/图片不合法等）转成可读提示
  if (data?.error_code) {
    throw new AppError(`识别失败（${data.error_code}）：${data.error_msg ?? '未知原因'}`, 502)
  }
  if (!data?.words_result) {
    throw new AppError('没能识别出内容，建议正对证件、避免反光后重拍', 502)
  }
  return data
}

// 行驶证识别：返回结构化字段（电话不在行驶证上，需人工补录）
router.post('/vehicle-license', asyncHandler(async (req, res) => {
  const { image } = req.body
  if (!image) throw new AppError('缺少图片数据')
  const data = await baiduOcr('vehicle_license', image)
  const w = data.words_result ?? {}
  const pick = (k: string): string | null => w[k]?.words ?? null
  res.json({
    plateNumber: pick('号牌号码'),
    owner: pick('所有人'),
    address: pick('住址'),
    vehicleType: pick('车辆类型'),
    brandModel: pick('品牌型号'),
    vin: pick('车辆识别代号'),
    registerDate: pick('注册日期')
  })
}))

// 车牌识别：返回单个车牌号
router.post('/plate', asyncHandler(async (req, res) => {
  const { image } = req.body
  if (!image) throw new AppError('缺少图片数据')
  const data = await baiduOcr('license_plate', image)
  const number: string | null = data.words_result?.number ?? null
  if (!number) throw new AppError('没能识别出车牌，建议正对车牌、避免反光后重拍', 502)
  res.json({ number })
}))

export default router
