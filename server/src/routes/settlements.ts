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
  // 金额必须是有限正数，拦截负数冲减已收、非数字导致 Prisma 报错
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) throw new AppError('收款金额必须大于0')

  const exists = await prisma.settlement.findUnique({ where: { id } })
  if (!exists) throw new AppError('结算单不存在', 404)

  // 收款记录与结算单/工单已收金额的同步重算同事务执行，
  // 避免"记录建了、金额没更"或反向的不一致状态
  const payment = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.findUnique({ where: { id } })
    if (!s) throw new AppError('结算单不存在', 404)

    // 拦截超额收款：超出剩余应收的入账会让挂账统计变负、实收与账单不符
    const sumsBefore = await tx.payment.aggregate({ where: { settlementId: id }, _sum: { amount: true } })
    const paidBefore = sumsBefore._sum.amount ?? 0
    if (amt > s.actualAmount - paidBefore) {
      throw new AppError('收款金额超过该结算单的剩余待收金额')
    }

    const created = await tx.payment.create({
      data: {
        settlementId: id,
        amount: amt,
        method: method || 'cash',
        type: type || 'initial',
        remark
      }
    })

    // 重新计算结算单已收金额和状态
    const sums = await tx.payment.aggregate({ where: { settlementId: id }, _sum: { amount: true } })
    const paid = sums._sum.amount ?? 0
    await tx.settlement.update({
      where: { id },
      data: { paidAmount: paid, status: paid >= s.actualAmount ? 'paid' : 'unpaid' }
    })
    // 同步更新工单的已收金额
    await tx.workOrder.update({ where: { id: s.workOrderId }, data: { paidAmount: paid } })

    return created
  })

  res.status(201).json(payment)
}))

export default router
