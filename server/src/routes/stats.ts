// 统计报表相关路由
import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler } from '../middleware/error'
import dayjs from 'dayjs'

const router = Router()

// 统计概览（月度营收趋势、工单分布、项目排行、挂账汇总）
router.get('/', asyncHandler(async (_req, res) => {
  // 近6个月营收趋势
  const months: Array<{ month: string; revenue: number; orderCount: number }> = []
  for (let i = 5; i >= 0; i--) {
    const date = dayjs().subtract(i, 'month')
    const startOfMonth = date.startOf('month').toDate()
    const endOfMonth = date.endOf('month').toDate()

    // 当月收款金额
    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } }
    })
    const revenue = payments.reduce((sum, p) => sum + p.amount, 0)

    // 当月工单数量
    const orderCount = await prisma.workOrder.count({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } }
    })

    months.push({
      month: date.format('YYYY-MM'),
      revenue,
      orderCount
    })
  }

  // 工单状态分布
  const statusCounts = await prisma.workOrder.groupBy({
    by: ['status'],
    _count: true
  })
  const statusDistribution = statusCounts.map(s => ({
    status: s.status,
    count: s._count
  }))

  // 维修项目热度排行（已完成工单中的项目）
  const completedOrders = await prisma.workOrder.findMany({
    where: { status: 'completed' },
    include: { repairItems: true }
  })
  const itemCount: Record<string, { count: number; total: number }> = {}
  for (const order of completedOrders) {
    for (const item of order.repairItems) {
      if (!itemCount[item.name]) {
        itemCount[item.name] = { count: 0, total: 0 }
      }
      itemCount[item.name].count += 1
      itemCount[item.name].total += item.subtotal
    }
  }
  const topItems = Object.entries(itemCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({ name, count: data.count, total: data.total }))

  // 挂账汇总
  const unpaidSettlements = await prisma.settlement.findMany({
    where: { status: 'unpaid' },
    include: { workOrder: { include: { customer: true, vehicle: true } } },
    orderBy: { createdAt: 'desc' }
  })
  const unpaidList = unpaidSettlements.map(s => ({
    id: s.id,
    settlementNo: s.settlementNo,
    totalAmount: s.totalAmount,
    actualAmount: s.actualAmount,
    paidAmount: s.paidAmount,
    unpaidAmount: s.actualAmount - s.paidAmount,
    customerName: s.workOrder.customer?.name,
    plateNumber: s.workOrder.vehicle?.plateNumber,
    orderId: s.workOrder.id,
    createdAt: s.createdAt
  }))
  const totalUnpaid = unpaidList.reduce((sum, s) => sum + s.unpaidAmount, 0)

  // 基础数据统计
  const [customerCount, vehicleCount, totalOrders] = await Promise.all([
    prisma.customer.count(),
    prisma.vehicle.count(),
    prisma.workOrder.count()
  ])

  // 总营收（所有已收款金额）
  const allPayments = await prisma.payment.findMany()
  const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0)

  res.json({
    months,
    statusDistribution,
    topItems,
    unpaid: {
      total: totalUnpaid,
      count: unpaidList.length,
      list: unpaidList
    },
    overview: {
      customerCount,
      vehicleCount,
      totalOrders,
      totalRevenue,
      completedOrders: completedOrders.length
    }
  })
}))

export default router
