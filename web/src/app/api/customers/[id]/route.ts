// 客户详情 / 更新 / 删除（自 Express customers.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

// 客户详情（含车辆、工单、消费统计）
export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    include: {
      vehicles: true,
      workOrders: {
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { plateNumber: true, brand: true, model: true } },
          settlement: { select: { actualAmount: true, status: true, paidAmount: true } }
        }
      }
    }
  })
  if (!customer) throw new AppError('客户不存在', 404)

  // 计算消费统计
  const completedOrders = customer.workOrders.filter(o => o.status === 'completed')
  const totalSpent = completedOrders.reduce((sum, o) => sum + (o.settlement?.actualAmount || 0), 0)
  const lastVisit = customer.workOrders.length > 0 ? customer.workOrders[0].createdAt : null

  return NextResponse.json({
    ...customer,
    stats: {
      totalOrders: customer.workOrders.length,
      completedOrders: completedOrders.length,
      totalSpent,
      lastVisit
    }
  })
})

// 更新客户
export const PUT = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const { name, phone, address, remark } = await req.json()

  const existing = await prisma.customer.findUnique({ where: { id: Number(id) } })
  if (!existing) throw new AppError('客户不存在', 404)

  // 修改手机号时校验唯一，避免唯一约束冲突抛出裸 500
  if (phone && phone !== existing.phone) {
    const dup = await prisma.customer.findUnique({ where: { phone } })
    if (dup) throw new AppError('该手机号已被其他客户使用')
  }

  const customer = await prisma.customer.update({
    where: { id: Number(id) },
    data: { name, phone, address, remark }
  })
  return NextResponse.json(customer)
})

// 删除客户
export const DELETE = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const existing = await prisma.customer.findUnique({ where: { id: Number(id) } })
  if (!existing) throw new AppError('客户不存在', 404)

  // 工单强制引用客户无法级联，先给业务化提示而非数据库裸错误
  const orderCount = await prisma.workOrder.count({ where: { customerId: Number(id) } })
  if (orderCount > 0) {
    throw new AppError(`该客户名下存在 ${orderCount} 张工单，无法删除`)
  }

  await prisma.customer.delete({ where: { id: Number(id) } })
  return NextResponse.json({ success: true })
})
