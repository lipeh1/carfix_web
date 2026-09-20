// 车辆列表 / 新增车辆（自 Express vehicles.ts 移植）
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

// 车辆列表
export const GET = withAuth(async (req: NextRequest) => {
  const keyword = req.nextUrl.searchParams.get('keyword') ?? undefined
  const customerId = req.nextUrl.searchParams.get('customerId')
  const where: Prisma.VehicleWhereInput = {}
  if (keyword) {
    where.plateNumber = { contains: keyword, mode: 'insensitive' }
  }
  if (customerId) {
    where.customerId = Number(customerId)
  }
  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  })
  return NextResponse.json(vehicles)
})

// 新增车辆
export const POST = withAuth(async (req: NextRequest) => {
  const { customerId, plateNumber, brand, model, year, vin, color, remark } = await req.json()
  if (!customerId || !plateNumber) throw new AppError('客户和车牌号不能为空')
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId,
      plateNumber,
      brand, model, year, vin, color, remark
    }
  })
  return NextResponse.json(vehicle, { status: 201 })
})
