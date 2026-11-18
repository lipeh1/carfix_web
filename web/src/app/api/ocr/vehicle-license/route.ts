// 行驶证与铭牌识别：调用视觉 Agent 提取可见字段，供前端核对后保存
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-helpers'
import { parseOcrImage, recognizeVehicleLicenseWithAgent } from '@/lib/ocr-agent'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  const image = parseOcrImage(body?.image)
  return NextResponse.json(await recognizeVehicleLicenseWithAgent(image.dataUrl, req.signal))
})
