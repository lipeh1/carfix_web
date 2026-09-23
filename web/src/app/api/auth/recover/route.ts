// 忘记密码自助找回：凭一次性恢复码重设密码，成功即登录
// 旧恢复码作废并下发新码（同样只显示一次），同 IP 连续失败 5 次锁定 60 秒
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import {
  getRecoveryHash, verifyPassword, setPasswordHash, setRecoveryHash, genRecoveryCode,
  isRecoverLocked, recordRecoverFail, clearRecoverFails, clearLoginFails
} from '@/lib/auth'
import { withRoute, attachSession, clientIp } from '@/lib/api-helpers'

export const POST = withRoute(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isRecoverLocked(ip)) {
    throw new AppError('尝试过于频繁，请 1 分钟后再试', 429)
  }
  const body = await req.json().catch(() => ({}))
  // 先做格式校验（不计失败次数），再验恢复码
  const newPassword = String(body.newPassword || '').trim()
  if (!newPassword || newPassword.length < 6) throw new AppError('新密码至少 6 位')
  // 输入归一化：忽略大小写与分隔符（- 和空格）
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const hash = await getRecoveryHash()
  if (!hash) throw new AppError('尚未生成恢复码，请登录后在「设置」中生成', 400)
  if (!code || !verifyPassword(code, hash)) {
    await recordRecoverFail(ip)
    throw new AppError('恢复码不正确', 401)
  }
  // 一次性使用：重设密码 + 换发新恢复码，清空两组失败计数并直接下发会话
  const newCode = genRecoveryCode()
  await setPasswordHash(newPassword)
  await setRecoveryHash(newCode)
  await clearRecoverFails(ip)
  await clearLoginFails(ip)
  const res = NextResponse.json({ success: true, recoveryCode: newCode })
  return attachSession(req, res)
})
