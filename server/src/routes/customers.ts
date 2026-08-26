import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// 客户列表
router.get('/', asyncHandler(async (req, res) => {
  const { keyword } = req.query
  const where: any = {}
  if (keyword) {
    where.OR = [
      { name: { contains: keyword as string } },
      { phone: { contains: keyword as string } }
    ]
  }
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { vehicles: true } }
    }
  })
  res.json(customers)
}))

// 客户详情（含车辆、工单、消费统计）
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id },
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

  res.json({
    ...customer,
    stats: {
      totalOrders: customer.workOrders.length,
      completedOrders: completedOrders.length,
      totalSpent,
      lastVisit
    }
  })
}))

// 新增客户
router.post('/', asyncHandler(async (req, res) => {
  const { name, phone, address, remark } = req.body
  if (!name || !phone) throw new AppError('姓名和电话不能为空')
  const exists = await prisma.customer.findUnique({ where: { phone } })
  if (exists) throw new AppError('该手机号已存在')
  const customer = await prisma.customer.create({
    data: { name, phone, address, remark }
  })
  res.status(201).json(customer)
}))

// 更新客户
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, phone, address, remark } = req.body
  const customer = await prisma.customer.update({
    where: { id: Number(req.params.id) },
    data: { name, phone, address, remark }
  })
  res.json(customer)
}))

// 删除客户
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: Number(req.params.id) } })
  res.json({ success: true })
}))

export default router
