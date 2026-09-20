// 工作台统计（自 Express dashboard.ts 移植）
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth(async () => {
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

  return NextResponse.json({
    pendingInspection,
    repairing,
    pendingSettlement,
    completed,
    monthlyRevenue,
    unpaidAmount
  })
})
