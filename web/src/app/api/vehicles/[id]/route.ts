// 车辆详情 / 更新（自 Express vehicles.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

// 车辆详情（含客户、维修历史、统计、保养提醒）
export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      workOrders: {
        orderBy: { createdAt: 'desc' },
        include: {
          repairItems: true,
          settlement: { select: { actualAmount: true, status: true, paidAmount: true } }
        }
      },
      reminders: {
        where: { status: 'pending' },
        orderBy: { remindDate: 'asc' }
      }
    }
  })
  if (!vehicle) throw new AppError('车辆不存在', 404)

  // 计算维修统计
  const completedOrders = vehicle.workOrders.filter(o => o.status === 'completed')
  const totalSpent = completedOrders.reduce((sum, o) => sum + (o.settlement?.actualAmount || 0), 0)
  const lastRepair = completedOrders.length > 0 ? completedOrders[0].createdAt : null

  // 统计维修项目频次
  const itemCount: Record<string, number> = {}
  for (const order of completedOrders) {
    for (const item of order.repairItems) {
      itemCount[item.name] = (itemCount[item.name] || 0) + 1
    }
  }
  const commonItems = Object.entries(itemCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({
    ...vehicle,
    stats: {
      totalRepairs: completedOrders.length,
      totalSpent,
      lastRepair,
      commonItems
    }
  })
})

// 更新车辆
export const PUT = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const existing = await prisma.vehicle.findUnique({ where: { id: Number(id) } })
  if (!existing) throw new AppError('车辆不存在', 404)

  const { plateNumber, brand, model, year, vin, color, remark } = await req.json()
  const vehicle = await prisma.vehicle.update({
    where: { id: Number(id) },
    data: {
      plateNumber,
      brand,
      model,
      // 年份转为数字入库，字符串会触发 Prisma 校验错误
      year: year === undefined || year === null || year === '' ? null : Number(year),
      vin, color, remark
    }
  })
  return NextResponse.json(vehicle)
})
