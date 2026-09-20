// 工单状态流转（自 Express orders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

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

export const PATCH = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const { status, ...data } = await req.json()
  const order = await prisma.workOrder.findUnique({ where: { id: Number(id) } })
  if (!order) throw new AppError('工单不存在', 404)

  // 目标必须是已知状态，且从当前状态出发允许到达
  if (!status || !(status in allowedTransitions)) {
    throw new AppError('未知的工单状态')
  }
  if (!allowedTransitions[order.status].includes(status)) {
    throw new AppError('当前状态下不允许执行该操作')
  }
  // 这两个状态必须走专用接口，避免跳过质检建账或交车提醒
  if (status === 'pending_settlement' || status === 'completed') {
    throw new AppError('请通过质检或交车操作完成状态流转')
  }

  const updateData: Prisma.WorkOrderUpdateInput = { status }

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

  const updated = await prisma.workOrder.update({ where: { id: Number(id) }, data: updateData })
  return NextResponse.json(updated)
})
