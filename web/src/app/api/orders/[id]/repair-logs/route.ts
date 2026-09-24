// 维修过程记录（自 Express orders.ts 移植）
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const { id } = await params
  const logs = await prisma.repairLog.findMany({
    where: { workOrderId: Number(id) },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json(logs)
})

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { id } = await params
  const { content } = await req.json()
  if (!content) throw new AppError('内容不能为空')
  const log = await prisma.repairLog.create({
    data: { workOrderId: Number(id), content }
  })
  return NextResponse.json(log, { status: 201 })
})
