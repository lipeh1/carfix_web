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

// 客户详情
router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      vehicles: true,
      workOrders: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!customer) throw new AppError('客户不存在', 404)
  res.json(customer)
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
