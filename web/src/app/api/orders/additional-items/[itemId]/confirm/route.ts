// 确认/拒绝增项（自 Express orders.ts 移植）
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const PATCH = withAuth<{ itemId: string }>(async (req, { params }) => {
  const { itemId: itemIdRaw } = await params
  const { confirmed } = await req.json()
  const itemId = Number(itemIdRaw)
  if (typeof confirmed !== 'boolean') throw new AppError('请明确确认或拒绝增项')

  // 校验与写入同事务完成，防止确认增项与质检结算交错后漏计费用
  await prisma.$transaction(async (tx) => {
    const item = await tx.additionalItem.findUnique({
      where: { id: itemId },
      include: { workOrder: { include: { settlement: true } } }
    })
    if (!item) throw new AppError('增项不存在', 404)
    if (item.status !== 'pending') {
      throw new AppError('该增项已确认或拒绝，请刷新后查看最新状态')
    }
    const order = item.workOrder
    if (!['repairing', 'pending_quality_check'].includes(order.status) || order.settlement) {
      throw new AppError('当前工单不可处理增项，请在质检结算前完成确认或拒绝')
    }

    if (confirmed) {
      // 标记确认，并生成对应的维修项目
      await tx.additionalItem.update({
        where: { id: itemId },
        data: { status: 'confirmed', confirmedAt: new Date() }
      })
      await tx.repairItem.create({
        data: {
          workOrderId: item.workOrderId,
          type: 'service',
          name: item.name,
          quantity: 1,
          unitPrice: item.amount,
          subtotal: item.amount,
          source: 'additional'
        }
      })
      // 基于工单当前全部明细重算最终金额：
      // 替代原先 finalAmount || quoteAmount 的增量累加，防止基数错误和重复累加
      const sums = await tx.repairItem.aggregate({
        where: { workOrderId: item.workOrderId },
        _sum: { subtotal: true }
      })
      await tx.workOrder.update({
        where: { id: item.workOrderId },
        data: { finalAmount: Math.max(0, (sums._sum.subtotal ?? 0) - order.discount) }
      })
    } else {
      await tx.additionalItem.update({
        where: { id: itemId },
        data: { status: 'rejected' }
      })
    }
  })
  return NextResponse.json({ success: true })
})
