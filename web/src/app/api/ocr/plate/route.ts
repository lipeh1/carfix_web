// 车牌识别：返回单个车牌号（自 Express ocr.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

// access_token 实例内缓存：与 vehicle-license 路由共享同一份实现（各自模块级缓存）
let tokenCache: { token: string; expiresAt: number } | null = null

const getConfig = () => ({
  apiKey: process.env.BAIDU_OCR_API_KEY || '',
  secretKey: process.env.BAIDU_OCR_SECRET_KEY || ''
})

async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`
  let data: any
  try {
    const res = await fetch(url, { method: 'POST' })
    data = await res.json()
  } catch {
    throw new AppError('识别服务无法连接，请稍后重试或改用手动输入', 502)
  }
  if (!data?.access_token) {
    throw new AppError('识别服务鉴权失败，请检查 API Key / Secret Key 配置', 502)
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in as number) - 3600) * 1000
  }
  return data.access_token as string
}

async function baiduOcr(endpoint: string, imageBase64: string): Promise<any> {
  const { apiKey, secretKey } = getConfig()
  if (!apiKey || !secretKey) {
    throw new AppError('识别服务未配置：请在环境变量填入 BAIDU_OCR_API_KEY 与 BAIDU_OCR_SECRET_KEY', 503)
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
  } catch {
    throw new AppError('识别服务无法连接，请稍后重试或改用手动输入', 502)
  }
  if (data?.error_code) {
    throw new AppError(`识别失败（${data.error_code}）：${data.error_msg ?? '未知原因'}`, 502)
  }
  if (!data?.words_result) {
    throw new AppError('没能识别出内容，建议正对证件、避免反光后重拍', 502)
  }
  return data
}

export const POST = withAuth(async (req: NextRequest) => {
  const { image } = await req.json()
  if (!image) throw new AppError('缺少图片数据')
  const data = await baiduOcr('license_plate', image)
  const number: string | null = data.words_result?.number ?? null
  if (!number) throw new AppError('没能识别出车牌，建议正对车牌、避免反光后重拍', 502)
  return NextResponse.json({ number })
})
