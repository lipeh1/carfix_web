// 结算单相关路由（收款等独立操作）
import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// 收款（支持首次收款和补款）
router.post('/:id/payments', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { amount, method, type, remark } = req.body
  if (!amount) throw new AppError('金额不能为空')

  // 创建收款记录
  const payment = await prisma.payment.create({
    data: {
      settlementId: id,
      amount: Number(amount),
      method: method || 'cash',
      type: type || 'initial',
      remark
    }
  })

  // 重新计算结算单已收金额和状态
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: { payments: true }
  })
  if (s) {
    const paid = s.payments.reduce((sum, p) => sum + p.amount, 0)
    const status = paid >= s.actualAmount ? 'paid' : 'unpaid'
    await prisma.settlement.update({ where: { id }, data: { paidAmount: paid, status } })
    // 同步更新工单的已收金额
    await prisma.workOrder.update({ where: { id: s.workOrderId }, data: { paidAmount: paid } })
  }

  res.status(201).json(payment)
}))

export default router
