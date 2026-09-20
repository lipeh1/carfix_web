// 查询该工单车辆最近一次已完成工单的报价项目（报价页「复制上次项目」）
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const order = await prisma.workOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError('工单不存在', 404)

  const last = await prisma.workOrder.findFirst({
    where: { vehicleId: order.vehicleId, status: 'completed', id: { not: orderId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNo: true, createdAt: true }
  })
  if (!last) return NextResponse.json({ order: null, items: [] })

  // 只取报价来源项目，增项有独立确认流程不参与复制
  const items = await prisma.repairItem.findMany({
    where: { workOrderId: last.id, source: 'quote' },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ order: last, items })
})
