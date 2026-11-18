// 车牌识别：调用服务端视觉 Agent，返回经格式校验的单个车牌号
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-helpers'
import { parseOcrImage, recognizePlateWithAgent } from '@/lib/ocr-agent'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  const image = parseOcrImage(body?.image)
  return NextResponse.json(await recognizePlateWithAgent(image.dataUrl, req.signal))
})
