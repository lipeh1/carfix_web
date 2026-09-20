// 结算单查询 / 创建与调整（自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import { genSettlementNo } from '@/lib/order-no'

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const s = await prisma.settlement.findUnique({
    where: { workOrderId: Number(id) },
    include: { payments: { orderBy: { createdAt: 'desc' } } }
  })
  return NextResponse.json(s)
})

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { discount, remark } = await req.json()
  if (discount !== undefined && (!Number.isSafeInteger(Number(discount)) || Number(discount) < 0)) {
    throw new AppError('优惠必须为不小于0的整数（单位:分）')
  }

  const s = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new AppError('工单不存在', 404)
    if (!['pending_settlement', 'completed'].includes(order.status)) {
      throw new AppError('请在质检通过后进行结算')
    }
    if (await tx.additionalItem.count({ where: { workOrderId: orderId, status: 'pending' } })) {
      throw new AppError('存在待确认增项，无法结算')
    }
    const items = await tx.repairItem.findMany({ where: { workOrderId: orderId } })
    const total = items.reduce((sum, i) => sum + i.subtotal, 0)
    // 请求未携带优惠时回落到报价阶段登记的工单优惠
    const disc = Math.min(discount !== undefined ? Number(discount) : order.discount, total)
    const actual = total - disc
    const existing = await tx.settlement.findUnique({ where: { workOrderId: orderId } })
    const paid = existing?.paidAmount ?? 0
    if (actual < paid) throw new AppError('结算金额不能低于已收金额')
    // 创建与调整都按实际欠款判断状态，零元账单无需伪造收款记录
    const status = paid >= actual ? 'paid' : 'unpaid'

    const saved = await tx.settlement.upsert({
      where: { workOrderId: orderId },
      update: { totalAmount: total, discount: disc, actualAmount: actual, status, remark },
      create: {
        workOrderId: orderId,
        settlementNo: await genSettlementNo(tx),
        totalAmount: total,
        discount: disc,
        actualAmount: actual,
        status,
        remark
      }
    })
    await tx.workOrder.update({ where: { id: orderId }, data: { finalAmount: actual } })
    if (status === 'paid') {
      await tx.reminder.updateMany({
        where: { workOrderId: orderId, type: 'collection', status: 'pending' },
        data: { status: 'done', feedback: '款项已结清，自动关闭催收' }
      })
    }
    return saved
  })
  return NextResponse.json(s)
})
