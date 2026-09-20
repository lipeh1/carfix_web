// 修改密码（需已登录）：验旧密码 → 存新哈希 → 重新下发会话
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { getPasswordHash, verifyPassword, setPasswordHash } from '@/lib/auth'
import { withAuth, attachSession } from '@/lib/api-helpers'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const { oldPassword, newPassword } = body
  const hash = await getPasswordHash()
  if (!hash || !verifyPassword(String(oldPassword || ''), hash)) {
    throw new AppError('原密码不正确')
  }
  if (!newPassword || String(newPassword).length < 6) throw new AppError('新密码至少 6 位')
  await setPasswordHash(String(newPassword))
  const res = NextResponse.json({ success: true })
  return attachSession(req, res)
})
