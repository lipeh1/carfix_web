// 首次设置访问密码（仅允许一次）
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { getPasswordHash, setPasswordHash } from '@/lib/auth'
import { withRoute, attachSession } from '@/lib/api-helpers'

export const POST = withRoute(async (req: NextRequest) => {
  if (await getPasswordHash()) throw new AppError('访问密码已初始化，请直接登录', 403)
  const body = await req.json().catch(() => ({}))
  // 去首尾空格：前端已 trim，此处双保险，避免手滑空格造成设置与登录不一致
  const password = String(body.password || '').trim()
  if (!password || password.length < 6) throw new AppError('密码至少 6 位')
  await setPasswordHash(password)
  const res = NextResponse.json({ success: true })
  return attachSession(req, res)
})
