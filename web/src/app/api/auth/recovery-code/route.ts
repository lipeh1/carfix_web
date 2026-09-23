// 生成/重置找回密码恢复码（需已登录）：旧恢复码立即作废，新码只显示一次
import { NextRequest, NextResponse } from 'next/server'
import { genRecoveryCode, setRecoveryHash } from '@/lib/auth'
import { withAuth } from '@/lib/api-helpers'

export const POST = withAuth(async (_req: NextRequest) => {
  const code = genRecoveryCode()
  await setRecoveryHash(code)
  return NextResponse.json({ recoveryCode: code })
})
