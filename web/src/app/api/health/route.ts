// 健康检查（公开访问，部署探活用）
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
