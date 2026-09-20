// 增项列表 / 新增（自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const items = await prisma.additionalItem.findMany({
    where: { workOrderId: Number(id) },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(items)
})

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { name, amount, reason } = await req.json()
  if (!name) throw new AppError('名称不能为空')
  // 金额为整数「分」，必须是正整数
  const amountFen = Number(amount)
  if (!Number.isSafeInteger(amountFen) || amountFen <= 0) {
    throw new AppError('金额必须为大于0的整数（单位:分）')
  }
  const item = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.findUnique({ where: { id: orderId }, include: { settlement: true } })
    if (!order) throw new AppError('工单不存在', 404)
    if (order.status !== 'repairing' || order.settlement) {
      throw new AppError('仅维修中且未结算的工单可以新增增项')
    }
    return tx.additionalItem.create({
      data: { workOrderId: orderId, name, amount: amountFen, reason }
    })
  })
  return NextResponse.json(item, { status: 201 })
})
