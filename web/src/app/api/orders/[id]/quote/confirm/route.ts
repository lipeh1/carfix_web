// 客户确认报价（自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { confirmed } = await req.json()
  const { id } = await params
  const orderId = Number(id)
  const order = await prisma.workOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError('工单不存在', 404)
  // 只有待报价确认的工单可以执行客户确认
  if (order.status !== 'pending_quote') {
    throw new AppError('工单不处于待报价确认状态')
  }
  if (confirmed) {
    await prisma.workOrder.update({
      where: { id: orderId },
      data: { status: 'repairing', quoteConfirmedAt: new Date(), repairStartedAt: new Date() }
    })
  }
  return NextResponse.json({ success: true })
})
