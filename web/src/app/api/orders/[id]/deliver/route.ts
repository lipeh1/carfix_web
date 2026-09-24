// 交车（自 Express orders.ts 移植）：完成工单 + 自动建回访/保养/催收提醒
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { mileageOut } = await req.json()

  const order = await prisma.workOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError('工单不存在', 404)
  // 只有待结算工单可以交车
  if (order.status !== 'pending_settlement') {
    throw new AppError('工单未处于待结算状态，无法交车')
  }
  // 防止重复交车：每次交车都会创建提醒记录，重复执行会产生多组冗余提醒
  if (order.deliveredAt) {
    throw new AppError('该工单已交车，请勿重复操作')
  }

  await prisma.workOrder.update({
    where: { id: orderId },
    data: {
      status: 'completed',
      deliveredAt: new Date(),
      mileageOut: mileageOut ? Number(mileageOut) : null
    }
  })

  // 自动创建保养提醒（3个月后或5000公里）和回访提醒（3天后）
  const reminderData: Array<{
    workOrderId: number
    vehicleId: number
    type: string
    remindDate: Date
    content: string
  }> = [
    {
      workOrderId: orderId,
      vehicleId: order.vehicleId,
      type: 'follow_up',
      remindDate: dayjs().add(3, 'day').toDate(),
      content: '维修后回访，确认车辆使用情况'
    },
    {
      workOrderId: orderId,
      vehicleId: order.vehicleId,
      type: 'maintenance',
      remindDate: dayjs().add(3, 'month').toDate(),
      content: '建议保养（约5000公里或3个月）'
    }
  ]

  // 挂账交车：自动生成 7/30 天催收提醒，欠款不追就静默流失
  const settlement = await prisma.settlement.findUnique({ where: { workOrderId: orderId } })
  if (settlement && settlement.actualAmount > settlement.paidAmount) {
    const unpaidFen = settlement.actualAmount - settlement.paidAmount
    const unpaidYuan = (unpaidFen / 100).toFixed(2)
    for (const days of [7, 30]) {
      reminderData.push({
        workOrderId: orderId,
        vehicleId: order.vehicleId,
        type: 'collection',
        remindDate: dayjs().add(days, 'day').toDate(),
        content: `催收挂账尾款 ¥${unpaidYuan}（工单 ${order.orderNo}，已挂账 ${days} 天）`
      })
    }
  }

  await prisma.reminder.createMany({ data: reminderData })

  return NextResponse.json({ success: true })
})
