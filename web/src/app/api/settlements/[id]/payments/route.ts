// 收款/补款（自 Express settlements.ts 移植）：支持首次收款与挂账补款
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

// 与 schema 注释一致的取值范围
const PAY_METHODS = ['cash', 'wechat', 'alipay', 'card', 'transfer']
const PAY_TYPES = ['initial', 'supplement']

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  const { amount, method, type, remark } = await req.json()
  // 收款方式/类型白名单：脏值会让按方式分组的统计静默漏算
  const payMethod = method || 'cash'
  const payType = type || 'initial'
  if (!PAY_METHODS.includes(payMethod)) throw new AppError('不支持的收款方式')
  if (!PAY_TYPES.includes(payType)) throw new AppError('不支持的收款类型')
  // 金额为整数「分」，必须是正整数，拦截负数冲减、小数或非数字
  const amt = Number(amount)
  if (!Number.isSafeInteger(amt) || amt <= 0) {
    throw new AppError('收款金额必须为大于0的整数（单位:分）')
  }

  const exists = await prisma.settlement.findUnique({ where: { id } })
  if (!exists) throw new AppError('结算单不存在', 404)

  // 收款记录与结算单/工单已收金额的同步重算同事务执行，
  // 避免「记录建了、金额没更」或反向的不一致状态
  const payment = await prisma.$transaction(async (tx) => {
    // 行锁住结算单：并发收款在此排队，后到者读到的已收合计包含先到者的入账，
    // 否则两笔并发请求都会通过下方超额校验（PostgreSQL / MySQL 均支持 FOR UPDATE）
    await tx.$queryRaw`SELECT id FROM settlements WHERE id = ${id} FOR UPDATE`
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
        method: payMethod,
        type: payType,
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

    // 挂账补清后关闭尚未处理的催收，保留已有回访和保养提醒
    if (paid >= s.actualAmount) {
      await tx.reminder.updateMany({
        where: { workOrderId: s.workOrderId, type: 'collection', status: 'pending' },
        data: { status: 'done', feedback: '款项已结清，自动关闭催收' }
      })
    }

    return created
  })

  return NextResponse.json(payment, { status: 201 })
})
