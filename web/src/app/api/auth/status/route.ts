// 初始化状态（是否已设置密码），登录页据此展示「设置/登录」两种形态
import { NextResponse } from 'next/server'
import { getPasswordHash } from '@/lib/auth'
import { withRoute } from '@/lib/api-helpers'

export const GET = withRoute(async () => {
  const hash = await getPasswordHash()
  return NextResponse.json({ initialized: !!hash })
})
