// 保存报价（维修项目/配件，自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { items, inspection, discount } = await req.json()

  // 校验工单存在，避免外键约束失败时返回裸 500
  const order = await prisma.workOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError('工单不存在', 404)
  // 报价只能在待检测/待报价确认阶段编辑：
  // 客户确认后再修改会使确认结果与实际项目脱节
  if (!['pending_inspection', 'pending_quote'].includes(order.status)) {
    throw new AppError('当前状态不可修改报价')
  }
  // 优惠金额随报价落库（单位:分），后续结算直接沿用
  const disc = Math.max(0, Math.round(Number(discount) || 0))

  // 删旧明细与重建、更新工单在同一事务内完成，
  // 中途失败时保留原报价而不是留下半份报价
  let total = 0
  await prisma.$transaction(async (tx) => {
    await tx.repairItem.deleteMany({ where: { workOrderId: orderId, source: 'quote' } })

    if (items && items.length > 0) {
      for (const item of items) {
        // 单价入参为整数「分」（接口统一分制，前端已用 yuanToFen 换算，服务端不可再乘 100，否则双重换算）
        const unitFen = Math.round(Number(item.unitPrice))
        if (!Number.isSafeInteger(unitFen) || unitFen < 0) {
          throw new AppError('单价必须是不小于0的整数（单位:分）')
        }
        const subtotal = Math.round(Number(item.quantity) * unitFen)
        total += subtotal
        await tx.repairItem.create({
          data: {
            workOrderId: orderId,
            type: item.type,
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: unitFen,
            subtotal,
            remark: item.remark,
            source: 'quote'
          }
        })
      }
    }

    await tx.workOrder.update({
      where: { id: orderId },
      data: {
        status: 'pending_quote',
        quoteAmount: total,
        discount: disc,
        // 检测结果独立持久化（此前该字段被直接丢弃，页面用客户诉求回充）
        inspection: inspection || null
      }
    })
  })

  return NextResponse.json({ success: true, total })
})
