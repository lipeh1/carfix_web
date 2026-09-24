// 质检（自 Express orders.ts 移植）：通过自动建结算单，不通过打回返工
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import { genSettlementNo } from '@/lib/order-no'

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { result, checkItems, remark } = await req.json()
  if (!['pass', 'fail'].includes(result)) throw new AppError('质检结果必须为通过或不通过')

  // 质检记录的替换、状态流转与结算单生成同事务执行，
  // 保证质检结果、工单状态、结算单三者始终一致
  const qc = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new AppError('工单不存在', 404)
    if (order.status !== 'pending_quality_check') {
      throw new AppError('工单未处于待质检状态，无法质检')
    }
    // 待确认增项不能越过结算边界，否则后续确认会与结算单金额脱节
    if (result === 'pass' && await tx.additionalItem.count({ where: { workOrderId: orderId, status: 'pending' } })) {
      throw new AppError('请先确认或拒绝所有待确认增项，再通过质检')
    }
    // 删除旧质检记录
    await tx.qualityCheck.deleteMany({ where: { workOrderId: orderId } })

    const created = await tx.qualityCheck.create({
      data: { workOrderId: orderId, result, checkItems: checkItems ? JSON.stringify(checkItems) : null, remark }
    })

    // 通过 → 待结算，自动生成结算单
    if (result === 'pass') {
      await tx.workOrder.update({ where: { id: orderId }, data: { status: 'pending_settlement' } })
      const existing = await tx.settlement.findUnique({ where: { workOrderId: orderId } })
      if (!existing) {
        const items = await tx.repairItem.findMany({ where: { workOrderId: orderId } })
        const total = items.reduce((sum, i) => sum + i.subtotal, 0)
        // 沿用报价阶段登记的优惠金额，优惠不大于应收总额
        const disc = Math.min(Math.max(0, order.discount || 0), total)
        await tx.settlement.create({
          data: {
            workOrderId: orderId,
            settlementNo: await genSettlementNo(tx),
            totalAmount: total,
            discount: disc,
            actualAmount: total - disc,
            status: total === disc ? 'paid' : 'unpaid'
          }
        })
        await tx.workOrder.update({ where: { id: orderId }, data: { finalAmount: total - disc } })
      }
    } else {
      // 不通过 → 返工
      await tx.workOrder.update({ where: { id: orderId }, data: { status: 'repairing' } })
    }

    return created
  })

  return NextResponse.json(qc)
})
