import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'
import dayjs from 'dayjs'

const router = Router()

// 接车登记（创建工单 + 接车记录 + 照片）
router.post('/', asyncHandler(async (req, res) => {
  const {
    customer_id,
    vehicle_id,
    complaint,
    mileage_in,
    vehicle_condition,
    photos,
    source
  } = req.body

  if (!customer_id || !vehicle_id) throw new AppError('客户和车辆不能为空')
  if (!complaint) throw new AppError('客户诉求不能为空')

  // 生成工单号
  const today = dayjs().format('YYYYMMDD')
  const count = await prisma.workOrder.count({
    where: { orderNo: { startsWith: `WO${today}` } }
  })
  const orderNo = `WO${today}${String(count + 1).padStart(3, '0')}`

  const order = await prisma.workOrder.create({
    data: {
      orderNo,
      customerId: customer_id,
      vehicleId: vehicle_id,
      status: 'pending_inspection',
      source: source || 'walk_in',
      complaint,
      mileageIn: mileage_in ? Number(mileage_in) : null
    }
  })

  // 创建接车记录
  await prisma.checkinRecord.create({
    data: {
      workOrderId: order.id,
      vehicleCondition: vehicle_condition
    }
  })

  // 保存照片
  if (photos && photos.length > 0) {
    await prisma.checkinPhoto.createMany({
      data: photos.map((p: string) => ({
        workOrderId: order.id,
        filePath: p
      }))
    })
  }

  res.status(201).json(order)
}))

export default router
