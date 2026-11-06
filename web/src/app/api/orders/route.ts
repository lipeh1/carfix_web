// 工单列表（自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

export const GET = withAuth(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const keyword = req.nextUrl.searchParams.get('keyword') ?? undefined
  const where: Prisma.WorkOrderWhereInput = {}
  if (status) where.status = status
  if (keyword) {
    // 不区分大小写由数据库排序规则保证（MySQL 默认 utf8mb4 为 _ci），
    // 不使用 Prisma 的 mode: 'insensitive'——MySQL 驱动不支持该选项
    where.OR = [
      { orderNo: { contains: keyword } },
      { complaint: { contains: keyword } },
      { vehicle: { plateNumber: { contains: keyword } } },
      { customer: { name: { contains: keyword } } }
    ]
  }
  const orders = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } }
    }
  })
  return NextResponse.json(orders)
})
