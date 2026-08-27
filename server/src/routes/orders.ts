import { Router } from 'express'
import prisma from '../prisma'
import { asyncHandler, AppError } from '../middleware/error'
import dayjs from 'dayjs'

const router = Router()

// 生成工单号
const genOrderNo = async () => {
  const today = dayjs().format('YYYYMMDD')
  const count = await prisma.workOrder.count({
    where: { orderNo: { startsWith: `WO${today}` } }
  })
  return `WO${today}${String(count + 1).padStart(3, '0')}`
}

// 工单列表
router.get('/', asyncHandler(async (req, res) => {
  const { status, keyword } = req.query
  const where: any = {}
  if (status) where.status = status
  if (keyword) {
    where.OR = [
      { orderNo: { contains: keyword as string } },
      { complaint: { contains: keyword as string } },
      { vehicle: { plateNumber: { contains: keyword as string } } },
      { customer: { name: { contains: keyword as string } } }
    ]
  }
  const orders = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } }
    }
  })
  res.json(orders)
}))

// 工单详情（全量关联）
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await prisma.workOrder.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: true,
      vehicle: true,
      checkinRecord: true,
      checkinPhotos: true,
      repairItems: { orderBy: { createdAt: 'asc' } },
      repairLogs: { orderBy: { createdAt: 'asc' } },
      additionalItems: { orderBy: { createdAt: 'desc' } },
      qualityCheck: true,
      settlement: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
      reminders: true
    }
  })
  if (!order) throw new AppError('工单不存在', 404)
  res.json(order)
}))

// 合法状态流转表（对应 DESIGN.md 的状态机）；不在表中的目标状态视为非法
const allowedTransitions: Record<string, string[]> = {
  pending_inspection: ['pending_quote', 'cancelled'],
  pending_quote: ['repairing', 'cancelled'],
  repairing: ['pending_quality_check'],
  pending_quality_check: ['pending_settlement', 'repairing'],
  pending_settlement: ['completed'],
  completed: [],
  cancelled: []
}

// 更新工单状态
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status, ...data } = req.body
  const id = Number(req.params.id)
  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)

  // 目标必须是已知状态，且从当前状态出发允许到达
  if (!status || !(status in allowedTransitions)) {
    throw new AppError('未知的工单状态')
  }
  if (!allowedTransitions[order.status].includes(status)) {
    throw new AppError('当前状态下不允许执行该操作')
  }

  const updateData: any = { status }

  // 状态流转副作用
  switch (status) {
    case 'repairing':
      updateData.repairStartedAt = new Date()
      if (!order.quoteConfirmedAt) updateData.quoteConfirmedAt = new Date()
      break
    case 'pending_quality_check':
      updateData.repairFinishedAt = new Date()
      break
    case 'cancelled':
      updateData.cancelledAt = new Date()
      updateData.cancelReason = data.cancelReason
      break
  }

  const updated = await prisma.workOrder.update({ where: { id }, data: updateData })
  res.json(updated)
}))

// 编辑接车信息（诉求、里程、车况）
router.patch('/:id/checkin', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { complaint, mileageIn, vehicleCondition } = req.body

  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)

  // 更新工单基本信息
  const updateData: any = {}
  if (complaint !== undefined) updateData.complaint = complaint
  if (mileageIn !== undefined) updateData.mileageIn = mileageIn ? Number(mileageIn) : null

  if (Object.keys(updateData).length > 0) {
    await prisma.workOrder.update({ where: { id }, data: updateData })
  }

  // 更新接车记录的车况描述
  if (vehicleCondition !== undefined) {
    const checkin = await prisma.checkinRecord.findFirst({ where: { workOrderId: id } })
    if (checkin) {
      await prisma.checkinRecord.update({
        where: { id: checkin.id },
        data: { vehicleCondition }
      })
    }
  }

  res.json({ success: true })
}))

// ===== 报价相关 =====

// 保存报价（维修项目/配件）
router.post('/:id/quote', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { items, inspection, discount } = req.body

  // 校验工单存在，避免外键约束失败时返回裸 500
  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)
  // 报价只能在待检测/待报价确认阶段编辑：
  // 客户确认后再修改会使确认结果与实际项目脱节
  if (!['pending_inspection', 'pending_quote'].includes(order.status)) {
    throw new AppError('当前状态不可修改报价')
  }
  // 优惠金额随报价落库，后续结算直接沿用（此前仅前端展示、传到结算就丢了）
  const disc = Math.max(0, Number(discount) || 0)

  // 删旧明细与重建、更新工单在同一事务内完成，
  // 中途失败时保留原报价而不是留下半份报价
  let total = 0
  await prisma.$transaction(async (tx) => {
    await tx.repairItem.deleteMany({ where: { workOrderId: id, source: 'quote' } })

    if (items && items.length > 0) {
      for (const item of items) {
        const subtotal = Number(item.quantity) * Number(item.unitPrice)
        total += subtotal
        await tx.repairItem.create({
          data: {
            workOrderId: id,
            type: item.type,
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            subtotal,
            remark: item.remark,
            source: 'quote'
          }
        })
      }
    }

    await tx.workOrder.update({
      where: { id },
      data: {
        status: 'pending_quote',
        quoteAmount: total,
        discount: disc,
        // 检测结果独立持久化（此前该字段被直接丢弃，页面用客户诉求回充）
        inspection: inspection || null
      }
    })
  })

  res.json({ success: true, total })
}))

// 客户确认报价
router.post('/:id/quote/confirm', asyncHandler(async (req, res) => {
  const { confirmed } = req.body
  const id = Number(req.params.id)
  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)
  // 只有待报价确认的工单可以执行客户确认
  if (order.status !== 'pending_quote') {
    throw new AppError('工单不处于待报价确认状态')
  }
  if (confirmed) {
    await prisma.workOrder.update({
      where: { id },
      data: { status: 'repairing', quoteConfirmedAt: new Date(), repairStartedAt: new Date() }
    })
  }
  res.json({ success: true })
}))

// ===== 维修记录 =====

router.get('/:id/repair-logs', asyncHandler(async (req, res) => {
  const logs = await prisma.repairLog.findMany({
    where: { workOrderId: Number(req.params.id) },
    orderBy: { createdAt: 'asc' }
  })
  res.json(logs)
}))

router.post('/:id/repair-logs', asyncHandler(async (req, res) => {
  const { content } = req.body
  if (!content) throw new AppError('内容不能为空')
  const log = await prisma.repairLog.create({
    data: { workOrderId: Number(req.params.id), content }
  })
  res.status(201).json(log)
}))

// ===== 增项 =====

router.get('/:id/additional-items', asyncHandler(async (req, res) => {
  const items = await prisma.additionalItem.findMany({
    where: { workOrderId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' }
  })
  res.json(items)
}))

router.post('/:id/additional-items', asyncHandler(async (req, res) => {
  const { name, amount, reason } = req.body
  if (!name || !amount) throw new AppError('名称和金额不能为空')
  const item = await prisma.additionalItem.create({
    data: { workOrderId: Number(req.params.id), name, amount: Number(amount), reason }
  })
  res.status(201).json(item)
}))

// 确认增项
router.patch('/additional-items/:itemId/confirm', asyncHandler(async (req, res) => {
  const { confirmed } = req.body
  const itemId = Number(req.params.itemId)
  const item = await prisma.additionalItem.findUnique({ where: { id: itemId } })
  if (!item) throw new AppError('增项不存在', 404)
  // 幂等保护：已处理的增项禁止再次确认/拒绝，避免重复写入项目和重复加价
  if (item.status !== 'pending') {
    throw new AppError('该增项已确认或拒绝，请刷新后查看最新状态')
  }

  if (confirmed) {
    await prisma.$transaction(async (tx) => {
      // 标记确认，并生成对应的维修项目
      await tx.additionalItem.update({
        where: { id: itemId },
        data: { status: 'confirmed', confirmedAt: new Date() }
      })
      await tx.repairItem.create({
        data: {
          workOrderId: item.workOrderId,
          type: 'service',
          name: item.name,
          quantity: 1,
          unitPrice: item.amount,
          subtotal: item.amount,
          source: 'additional'
        }
      })
      // 基于工单当前全部明细重算最终金额：
      // 替代原先 finalAmount || quoteAmount 的增量累加，防止基数错误和重复累加
      const sums = await tx.repairItem.aggregate({
        where: { workOrderId: item.workOrderId },
        _sum: { subtotal: true }
      })
      await tx.workOrder.update({
        where: { id: item.workOrderId },
        data: { finalAmount: sums._sum.subtotal ?? 0 }
      })
    })
  } else {
    await prisma.additionalItem.update({
      where: { id: itemId },
      data: { status: 'rejected' }
    })
  }
  res.json({ success: true })
}))

// ===== 质检 =====

router.post('/:id/quality-check', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { result, checkItems, remark } = req.body
  if (!result) throw new AppError('质检结果不能为空')

  // 校验工单存在，结算金额计算也需要工单上的优惠信息
  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)
  // 只有待质检的工单可以录入质检结果
  if (order.status !== 'pending_quality_check') {
    throw new AppError('工单未处于待质检状态，无法质检')
  }

  // 质检记录的替换、状态流转与结算单生成同事务执行，
  // 保证质检结果、工单状态、结算单三者始终一致
  const qc = await prisma.$transaction(async (tx) => {
    // 删除旧质检记录
    await tx.qualityCheck.deleteMany({ where: { workOrderId: id } })

    const created = await tx.qualityCheck.create({
      data: { workOrderId: id, result, checkItems: checkItems ? JSON.stringify(checkItems) : null, remark }
    })

    // 通过 → 待结算，自动生成结算单
    if (result === 'pass') {
      await tx.workOrder.update({ where: { id }, data: { status: 'pending_settlement' } })
      const existing = await tx.settlement.findUnique({ where: { workOrderId: id } })
      if (!existing) {
        const items = await tx.repairItem.findMany({ where: { workOrderId: id } })
        const total = items.reduce((sum, i) => sum + i.subtotal, 0)
        // 沿用报价阶段登记的优惠金额，优惠不大于应收总额
        const disc = Math.min(Math.max(0, order.discount || 0), total)
        const today = dayjs().format('YYYYMMDD')
        const count = await tx.settlement.count({ where: { settlementNo: { startsWith: `SET${today}` } } })
        await tx.settlement.create({
          data: {
            workOrderId: id,
            settlementNo: `SET${today}${String(count + 1).padStart(3, '0')}`,
            totalAmount: total,
            discount: disc,
            actualAmount: total - disc,
            status: 'unpaid'
          }
        })
        await tx.workOrder.update({ where: { id }, data: { finalAmount: total - disc } })
      }
    } else {
      // 不通过 → 返工
      await tx.workOrder.update({ where: { id }, data: { status: 'repairing' } })
    }

    return created
  })

  res.json(qc)
}))

// ===== 结算 =====

router.get('/:id/settlement', asyncHandler(async (req, res) => {
  const s = await prisma.settlement.findUnique({
    where: { workOrderId: Number(req.params.id) },
    include: { payments: { orderBy: { createdAt: 'desc' } } }
  })
  res.json(s)
}))

router.post('/:id/settlement', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { discount, remark } = req.body
  const items = await prisma.repairItem.findMany({ where: { workOrderId: id } })
  const total = items.reduce((sum, i) => sum + i.subtotal, 0)
  // 请求未携带优惠时回落到报价阶段登记的工单优惠
  const order = await prisma.workOrder.findUnique({ where: { id } })
  if (!order) throw new AppError('工单不存在', 404)
  const disc = Math.min(
    discount !== undefined ? Math.max(0, Number(discount) || 0) : Math.max(0, order.discount || 0),
    total
  )
  const actual = total - disc

  const today = dayjs().format('YYYYMMDD')
  const count = await prisma.settlement.count({ where: { settlementNo: { startsWith: `SET${today}` } } })

  const s = await prisma.settlement.upsert({
    where: { workOrderId: id },
    update: { totalAmount: total, discount: disc, actualAmount: actual, remark },
    create: {
      workOrderId: id,
      settlementNo: `SET${today}${String(count + 1).padStart(3, '0')}`,
      totalAmount: total,
      discount: disc,
      actualAmount: actual,
      status: 'unpaid',
      remark
    }
  })
  await prisma.workOrder.update({ where: { id }, data: { finalAmount: actual } })
  res.json(s)
}))

// ===== 交车 =====

router.post('/:id/deliver', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const { mileageOut } = req.body

  const order = await prisma.workOrder.findUnique({ where: { id } })
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
    where: { id },
    data: {
      status: 'completed',
      deliveredAt: new Date(),
      mileageOut: mileageOut ? Number(mileageOut) : null
    }
  })

  // 自动创建保养提醒（3个月后或5000公里）和回访提醒（3天后）
  await prisma.reminder.createMany({
    data: [
      {
        workOrderId: id,
        vehicleId: order.vehicleId,
        type: 'follow_up',
        remindDate: dayjs().add(3, 'day').toDate(),
        content: '维修后回访，确认车辆使用情况'
      },
      {
        workOrderId: id,
        vehicleId: order.vehicleId,
        type: 'maintenance',
        remindDate: dayjs().add(3, 'month').toDate(),
        content: '建议保养（约5000公里或3个月）'
      }
    ]
  })

  res.json({ success: true })
}))

export default router
