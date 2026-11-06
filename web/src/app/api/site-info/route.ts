// 站点合规信息（公开接口，无需登录）
// 用途：登录页底部展示 ICP 备案号与公安联网备案号
// 为什么走接口而不是 NEXT_PUBLIC_ 变量：NEXT_PUBLIC_* 在构建期被固化进客户端包，
// 云托管改环境变量必须重新构建才生效；备案号属于部署配置，走运行时读取更合理
import { NextResponse } from 'next/server'
import { withRoute } from '@/lib/api-helpers'

export const GET = withRoute(async () => {
  return NextResponse.json({
    // 形如「粤ICP备2026xxxxxx号-1」，未备案时为空字符串
    icp: process.env.ICP_BEIAN ?? '',
    // 形如「粤公网安备 44030502001234号」，未做公安备案时为空字符串
    police: process.env.POLICE_BEIAN ?? ''
  })
})
