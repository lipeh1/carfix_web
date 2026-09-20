// 接车登记（创建工单 + 接车记录 + 照片，自 Express checkin.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import { genOrderNo } from '@/lib/order-no'

export const POST = withAuth(async (req: NextRequest) => {
  const {
    customerId,
    vehicleId,
    complaint,
    mileageIn,
    vehicleCondition,
    photos,
    source
  } = await req.json()

  if (!customerId || !vehicleId) throw new AppError('客户和车辆不能为空')
  if (!complaint) throw new AppError('客户诉求不能为空')

  // 校验客户/车辆存在且车辆属于该客户，
  // 避免外键约束失败变成裸 500 或产生跨客户错配的工单
  const [customer, vehicle] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId } })
  ])
  if (!customer) throw new AppError('所选客户不存在')
  if (!vehicle) throw new AppError('所选车辆不存在')
  if (vehicle.customerId !== customer.id) throw new AppError('该车辆不属于所选客户')

  // 生成工单号
  const orderNo = await genOrderNo()

  // 工单/接车记录/照片在同一事务写入，
  // 避免中途失败产生没有接车记录的孤儿工单
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.workOrder.create({
      data: {
        orderNo,
        customerId,
        vehicleId,
        status: 'pending_inspection',
        source: source || 'walk_in',
        complaint,
        mileageIn: mileageIn ? Number(mileageIn) : null
      }
    })

    await tx.checkinRecord.create({
      data: {
        workOrderId: created.id,
        vehicleCondition
      }
    })

    if (photos && photos.length > 0) {
      await tx.checkinPhoto.createMany({
        data: photos.map((p: string) => ({
          workOrderId: created.id,
          filePath: p
        }))
      })
    }

    return created
  })

  return NextResponse.json(order, { status: 201 })
})
