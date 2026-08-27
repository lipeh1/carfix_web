import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'
import dayjs from 'dayjs'

const router = Router()

// 接车登记（创建工单 + 接车记录 + 照片）
router.post('/', asyncHandler(async (req, res) => {
  const {
    customerId,
    vehicleId,
    complaint,
    mileageIn,
    vehicleCondition,
    photos,
    source
  } = req.body

  if (!customerId || !vehicleId) throw new AppError('客户和车辆不能为空')
  if (!complaint) throw new AppError('客户诉求不能为空')

  // 生成工单号
  const today = dayjs().format('YYYYMMDD')
  const count = await prisma.workOrder.count({
    where: { orderNo: { startsWith: `WO${today}` } }
  })
  const orderNo = `WO${today}${String(count + 1).padStart(3, '0')}`

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

  res.status(201).json(order)
}))

export default router
