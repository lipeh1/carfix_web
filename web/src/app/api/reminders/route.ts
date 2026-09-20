// 提醒列表（自 Express reminders.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

export const GET = withAuth(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const type = req.nextUrl.searchParams.get('type') ?? undefined
  const where: Prisma.ReminderWhereInput = {}
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
  return NextResponse.json(reminders)
})
