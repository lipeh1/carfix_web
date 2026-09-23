// 修改密码（需已登录）：验旧密码 → 存新哈希 → 换发新恢复码 → 重新下发会话
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { getPasswordHash, verifyPassword, setPasswordHash, setRecoveryHash, genRecoveryCode } from '@/lib/auth'
import { withAuth, attachSession } from '@/lib/api-helpers'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const { oldPassword, newPassword } = body
  const hash = await getPasswordHash()
  if (!hash || !verifyPassword(String(oldPassword || ''), hash)) {
    throw new AppError('原密码不正确')
  }
  if (!newPassword || String(newPassword).length < 6) throw new AppError('新密码至少 6 位')
  // 改密后旧恢复码一并作废，换发新码随响应返回（只显示一次）
  const recoveryCode = genRecoveryCode()
  await setPasswordHash(String(newPassword))
  await setRecoveryHash(recoveryCode)
  const res = NextResponse.json({ success: true, recoveryCode })
  return attachSession(req, res)
})
