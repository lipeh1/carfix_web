// 登出：清空会话 Cookie（未登录调用也无害）
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
