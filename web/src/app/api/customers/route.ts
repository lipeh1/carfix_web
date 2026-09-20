// 客户列表 / 新增客户（自 Express customers.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

// 客户列表：按最近到店排序，输出 lastVisitAt
export const GET = withAuth(async (req: NextRequest) => {
  const keyword = req.nextUrl.searchParams.get('keyword') ?? undefined
  const where: Prisma.CustomerWhereInput = {}
  if (keyword) {
    // mode insensitive 对齐原 SQLite 的不区分大小写行为
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { phone: { contains: keyword, mode: 'insensitive' } }
    ]
  }
  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { vehicles: true } },
      // 只取最近一张工单的时间用于「最近到店」排序
      workOrders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy: { createdAt: 'desc' }
  })
  // 按最近到店排序（无工单的新客户排后面），并输出 lastVisitAt 供前端展示
  const sorted = customers
    .sort((a, b) =>
      (b.workOrders[0]?.createdAt?.getTime() ?? 0) - (a.workOrders[0]?.createdAt?.getTime() ?? 0)
    )
    .map(({ workOrders, ...c }) => ({ ...c, lastVisitAt: workOrders[0]?.createdAt ?? null }))
  return NextResponse.json(sorted)
})

// 新增客户
export const POST = withAuth(async (req: NextRequest) => {
  const { name, phone, address, remark } = await req.json()
  if (!name || !phone) throw new AppError('姓名和电话不能为空')
  const exists = await prisma.customer.findUnique({ where: { phone } })
  if (exists) throw new AppError('该手机号已存在')
  const customer = await prisma.customer.create({
    data: { name, phone, address, remark }
  })
  return NextResponse.json(customer, { status: 201 })
})
