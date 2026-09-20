// 工单详情（全量关联，自 Express orders.ts 移植）
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const order = await prisma.workOrder.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      vehicle: true,
      checkinRecord: true,
      checkinPhotos: true,
      repairItems: { orderBy: { createdAt: 'asc' } },
      repairLogs: { orderBy: { createdAt: 'asc' } },
      additionalItems: { orderBy: { createdAt: 'desc' } },
      qualityCheck: true,
      settlement: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
      reminders: true
    }
  })
  if (!order) throw new AppError('工单不存在', 404)
  return NextResponse.json(order)
})
