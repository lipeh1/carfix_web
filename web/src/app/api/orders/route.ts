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
    where.OR = [
      { orderNo: { contains: keyword, mode: 'insensitive' } },
      { complaint: { contains: keyword, mode: 'insensitive' } },
      { vehicle: { plateNumber: { contains: keyword, mode: 'insensitive' } } },
      { customer: { name: { contains: keyword, mode: 'insensitive' } } }
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
