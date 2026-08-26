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

// 车辆详情（含客户、维修历史、统计、保养提醒）
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
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

  res.json({
    ...vehicle,
    stats: {
      totalRepairs: completedOrders.length,
      totalSpent,
      lastRepair,
      commonItems
    }
  })
}))

// 新增车辆
router.post('/', asyncHandler(async (req, res) => {
  const { customerId, plateNumber, brand, model, year, vin, color, remark } = req.body
  if (!customerId || !plateNumber) throw new AppError('客户和车牌号不能为空')
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId,
      plateNumber,
      brand, model, year, vin, color, remark
    }
  })
  res.status(201).json(vehicle)
}))

// 更新车辆
router.put('/:id', asyncHandler(async (req, res) => {
  const { plateNumber, brand, model, year, vin, color, remark } = req.body
  const vehicle = await prisma.vehicle.update({
    where: { id: Number(req.params.id) },
    data: { plateNumber, brand, model, year, vin, color, remark }
  })
  res.json(vehicle)
}))

export default router
