// 提醒详情 / 更新 / 删除（自 Express reminders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

// 提醒详情
export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const r = await prisma.reminder.findUnique({
    where: { id: Number(id) },
    include: { vehicle: true, workOrder: true }
  })
  if (!r) throw new AppError('提醒不存在', 404)
  return NextResponse.json(r)
})

// 更新提醒（标记已提醒等）
export const PATCH = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const { status, remindedAt, remindMethod, feedback, content, remindDate } = await req.json()
  const data: Prisma.ReminderUpdateInput = {}
  if (status) data.status = status
  if (remindedAt) data.remindedAt = new Date(remindedAt)
  if (remindMethod) data.remindMethod = remindMethod
  if (feedback !== undefined) data.feedback = feedback
  if (content !== undefined) data.content = content
  if (remindDate) data.remindDate = new Date(remindDate)

  const r = await prisma.reminder.update({
    where: { id: Number(id) },
    data
  })
  return NextResponse.json(r)
})

// 删除提醒
export const DELETE = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  await prisma.reminder.delete({ where: { id: Number(id) } })
  return NextResponse.json({ success: true })
})
