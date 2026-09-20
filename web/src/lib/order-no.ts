// 单号生成：WO（工单）/ SET（结算单）+ 日期 + 3 位序号
// 同日序号按现有数量 +1 推算，并发撞号由数据库唯一约束兜底
import dayjs from 'dayjs'
import type { Prisma } from '@prisma/client'
import prisma from './prisma'

type Client = Prisma.TransactionClient | typeof prisma

// 生成工单号
export async function genOrderNo(client: Client = prisma): Promise<string> {
  const today = dayjs().format('YYYYMMDD')
  const count = await client.workOrder.count({
    where: { orderNo: { startsWith: `WO${today}` } }
  })
  return `WO${today}${String(count + 1).padStart(3, '0')}`
}

// 生成结算单号
export async function genSettlementNo(client: Client = prisma): Promise<string> {
  const today = dayjs().format('YYYYMMDD')
  const count = await client.settlement.count({
    where: { settlementNo: { startsWith: `SET${today}` } }
  })
  return `SET${today}${String(count + 1).padStart(3, '0')}`
}
