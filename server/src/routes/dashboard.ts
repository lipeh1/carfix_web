import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler } from '../middleware/error'
import dayjs from 'dayjs'

const router = Router()

// 工作台统计
router.get('/', asyncHandler(async (_req, res) => {
  const [pendingInspection, repairing, pendingSettlement, completed, monthPayments] = await Promise.all([
    prisma.workOrder.count({ where: { status: 'pending_inspection' } }),
    prisma.workOrder.count({ where: { status: 'repairing' } }),
    prisma.workOrder.count({ where: { status: 'pending_settlement' } }),
    prisma.workOrder.count({ where: { status: 'completed' } }),
    // 本月实际发生的收款（按支付时间），与统计报表页的月度趋势口径保持一致
    prisma.payment.findMany({
      where: { createdAt: { gte: dayjs().startOf('month').toDate() } }
    })
  ])

  const monthlyRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0)

  // 挂账总额 = 所有未结清的 actualAmount - paidAmount
  const unpaidSettlements = await prisma.settlement.findMany({ where: { status: 'unpaid' } })
  const unpaidAmount = unpaidSettlements.reduce((sum, s) => sum + (s.actualAmount - s.paidAmount), 0)

  res.json({
    pendingInspection,
    repairing,
    pendingSettlement,
    completed,
    monthlyRevenue,
    unpaidAmount
  })
}))

export default router
