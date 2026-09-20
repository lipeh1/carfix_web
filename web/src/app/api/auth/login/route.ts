// 密码登录（同 IP 连续失败 5 次锁定 60 秒，计数存 settings 表，多实例生效）
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { getPasswordHash, verifyPassword, isLoginLocked, recordLoginFail, clearLoginFails } from '@/lib/auth'
import { withRoute, attachSession, clientIp } from '@/lib/api-helpers'

export const POST = withRoute(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isLoginLocked(ip)) {
    throw new AppError('尝试过于频繁，请 1 分钟后再试', 429)
  }
  const body = await req.json().catch(() => ({}))
  const password = String(body.password || '').trim()
  const hash = await getPasswordHash()
  if (!hash || !password || !verifyPassword(password, hash)) {
    await recordLoginFail(ip)
    // 提示携带输入注意点：大小写敏感是密码验证的常态，提前说明减少反复试错触发锁定
    throw new AppError('密码不正确（注意大小写）', 401)
  }
  await clearLoginFails(ip)
  const res = NextResponse.json({ success: true })
  return attachSession(req, res)
})
