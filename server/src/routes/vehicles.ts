import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// 车辆列表
router.get('/', asyncHandler(async (req, res) => {
  const { keyword, customerId } = req.query
  const where: any = {}
  if (keyword) {
    where.plateNumber = { contains: keyword as string }
  }
  if (customerId) {
    where.customerId = Number(customerId)
  }
  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  })
  res.json(vehicles)
}))

// 车辆详情
router.get('/:id', asyncHandler(async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: true,
      workOrders: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!vehicle) throw new AppError('车辆不存在', 404)
  res.json(vehicle)
}))

// 新增车辆
router.post('/', asyncHandler(async (req, res) => {
  const { customer_id, plate_number, brand, model, year, vin, color, remark } = req.body
  if (!customer_id || !plate_number) throw new AppError('客户和车牌号不能为空')
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId: customer_id,
      plateNumber: plate_number,
      brand, model, year, vin, color, remark
    }
  })
  res.status(201).json(vehicle)
}))

// 更新车辆
router.put('/:id', asyncHandler(async (req, res) => {
  const { plate_number, brand, model, year, vin, color, remark } = req.body
  const vehicle = await prisma.vehicle.update({
    where: { id: Number(req.params.id) },
    data: { plateNumber: plate_number, brand, model, year, vin, color, remark }
  })
  res.json(vehicle)
}))

export default router
