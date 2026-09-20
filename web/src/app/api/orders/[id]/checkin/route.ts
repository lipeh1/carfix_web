// 编辑接车信息（诉求、里程、车况，自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const PATCH = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const orderId = Number(id)
  const { complaint, mileageIn, vehicleCondition } = await req.json()

  const order = await prisma.workOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError('工单不存在', 404)

  // 更新工单基本信息
  const updateData: Record<string, unknown> = {}
  if (complaint !== undefined) updateData.complaint = complaint
  if (mileageIn !== undefined) updateData.mileageIn = mileageIn ? Number(mileageIn) : null

  if (Object.keys(updateData).length > 0) {
    await prisma.workOrder.update({ where: { id: orderId }, data: updateData })
  }

  // 更新接车记录的车况描述
  if (vehicleCondition !== undefined) {
    const checkin = await prisma.checkinRecord.findFirst({ where: { workOrderId: orderId } })
    if (checkin) {
      await prisma.checkinRecord.update({
        where: { id: checkin.id },
        data: { vehicleCondition }
      })
    }
  }

  return NextResponse.json({ success: true })
})
