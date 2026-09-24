// 店铺名称（全局设置）：GET 读取 / PUT 保存，存 settings 表 KV
// 跨设备一致：改一处全局生效，报价单长图页眉取用
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

const KEY = 'shop:name'
// 与前端 lib/shop.ts 的 SHOP_NAME_MAX_LEN 保持一致
const MAX_LEN = 12

export const GET = withAuth(async () => {
  const row = await prisma.setting.findUnique({ where: { key: KEY } })
  // 未设置返回空串，由前端回退默认名展示
  return NextResponse.json({ shopName: row?.value ?? '' })
})

export const PUT = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const name = String(body.shopName ?? '').trim()
  if (name.length > MAX_LEN) throw new AppError(`店名最多 ${MAX_LEN} 字`)
  // 存空值即删除记录，回退默认名
  if (name) {
    await prisma.setting.upsert({
      where: { key: KEY },
      update: { value: name },
      create: { key: KEY, value: name }
    })
  } else {
    await prisma.setting.deleteMany({ where: { key: KEY } })
  }
  return NextResponse.json({ shopName: name })
})
