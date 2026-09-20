// 会话检查：已登录 200，未登录 401（前端登录页用于判断能否直接进入）
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth(async () => {
  return NextResponse.json({ authed: true })
})
