import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// 提醒列表
router.get('/', asyncHandler(async (req, res) => {
  const { status, type } = req.query
  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type

  const reminders = await prisma.reminder.findMany({
    where,
    orderBy: [{ status: 'asc' }, { remindDate: 'asc' }],
    include: {
      vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
      workOrder: { select: { id: true, orderNo: true } }
    }
  })
  res.json(reminders)
}))

// 提醒详情
router.get('/:id', asyncHandler(async (req, res) => {
  const r = await prisma.reminder.findUnique({
    where: { id: Number(req.params.id) },
    include: { vehicle: true, workOrder: true }
  })
  if (!r) throw new AppError('提醒不存在', 404)
  res.json(r)
}))

// 更新提醒（标记已提醒等）
router.patch('/:id', asyncHandler(async (req, res) => {
  const { status, reminded_at, remind_method, feedback, content, remind_date } = req.body
  const data: any = {}
  if (status) data.status = status
  if (reminded_at) data.remindedAt = new Date(reminded_at)
  if (remind_method) data.remindMethod = remind_method
  if (feedback !== undefined) data.feedback = feedback
  if (content !== undefined) data.content = content
  if (remind_date) data.remindDate = new Date(remind_date)

  const r = await prisma.reminder.update({
    where: { id: Number(req.params.id) },
    data
  })
  res.json(r)
}))

// 删除提醒
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.reminder.delete({ where: { id: Number(req.params.id) } })
  res.json({ success: true })
}))

export default router
