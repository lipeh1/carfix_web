// 结算流程回归：通过真实 HTTP 接口（含鉴权）验证增项、挂账补款及零元结算。
// （自旧 server/tests/settlement-flow.cjs 移植，直接打 Next Route Handlers）
// 用法：BASE_URL=http://127.0.0.1:8890 DATABASE_URL=... node scripts/settlement-flow.mjs
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8890'
const prisma = new PrismaClient()

// 带会话 Cookie 的 HTTP 调用（首次自动完成设置密码）
let cookie = ''
async function call(method, url, body = {}, expectedStatus = 200) {
  const res = await fetch(`${BASE_URL}/api${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {})
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body)
  })
  // 记录会话 Cookie
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* 非 JSON */ }
  assert.equal(res.statusCode ?? res.status, expectedStatus, `${method} ${url}: ${text}`)
  return data
}

async function main() {
  // 空库时设置访问密码并登录，拿到会话（复用幂等：已初始化则直接登录）
  try {
    await call('POST', '/auth/setup', { password: 'test123456' })
  } catch {
    await call('POST', '/auth/login', { password: 'test123456' })
  }

  // 每次运行用唯一后缀，测试可重复执行（不清理历史数据）
  const runId = Date.now().toString(36).slice(-6)
  const customer = await prisma.customer.create({ data: { name: '回归测试', phone: `138${runId}`.slice(0, 11) } })
  const vehicle = await prisma.vehicle.create({ data: { customerId: customer.id, plateNumber: `测A${runId}` } })
  let orderIndex = 0
  const createOrder = (discount = 0, status = 'repairing') => prisma.workOrder.create({ data: {
    orderNo: `TEST${runId}_${++orderIndex}`, customerId: customer.id, vehicleId: vehicle.id, status, discount,
    repairItems: { create: { type: 'service', name: '基础维修', quantity: 1, unitPrice: 10000, subtotal: 10000 } }
  } })
  const detail = id => prisma.workOrder.findUnique({
    where: { id }, include: { settlement: { include: { payments: true } }, reminders: true, repairItems: true }
  })

  const order = await createOrder(1000)
  const additional = await call('POST', `/orders/${order.id}/additional-items`, { name: '更换配件', amount: 2000 }, 201)
  await call('POST', `/orders/${order.id}/settlement`, {}, 400)
  await call('PATCH', `/orders/${order.id}/status`, { status: 'pending_quality_check' })
  await call('PATCH', `/orders/${order.id}/status`, { status: 'pending_settlement' }, 400)
  await call('POST', `/orders/${order.id}/quality-check`, { result: 'pass' }, 400)
  assert.equal((await detail(order.id)).settlement, null)
  await call('PATCH', `/orders/additional-items/${additional.id}/confirm`, { confirmed: true })
  await call('PATCH', `/orders/additional-items/${additional.id}/confirm`, { confirmed: true }, 400)
  await call('POST', `/orders/${order.id}/quality-check`, { result: 'pass' })
  let saved = await detail(order.id)
  assert.equal(saved.settlement.actualAmount, 11000)
  assert.equal(saved.finalAmount, 11000)
  assert.equal(saved.repairItems.length, 2)
  console.log('通过：待确认增项阻止结算，确认后优惠及增项金额正确且不会重复计费')

  await call('POST', `/orders/${order.id}/additional-items`, { name: '结算后增项', amount: 100 }, 400)
  // 模拟旧版本留下的待确认增项，验证结算后不能再改变收费明细
  const legacyItem = await prisma.additionalItem.create({ data: { workOrderId: order.id, name: '遗留增项', amount: 100 } })
  await call('PATCH', `/orders/additional-items/${legacyItem.id}/confirm`, { confirmed: true }, 400)
  assert.equal((await detail(order.id)).settlement.actualAmount, 11000)
  await call('POST', `/settlements/${saved.settlement.id}/payments`, { amount: 3000 }, 201)
  await call('POST', `/orders/${order.id}/deliver`)
  saved = await detail(order.id)
  assert.equal(saved.status, 'completed')
  assert.equal(saved.reminders.filter(r => r.type === 'collection' && r.status === 'pending').length, 2)
  await call('PATCH', `/orders/additional-items/${legacyItem.id}/confirm`, { confirmed: true }, 400)
  await call('POST', `/settlements/${saved.settlement.id}/payments`, { amount: 8001 }, 400)
  await call('POST', `/settlements/${saved.settlement.id}/payments`, { amount: 8000, type: 'supplement' }, 201)
  saved = await detail(order.id)
  assert.equal(saved.settlement.status, 'paid')
  assert.equal(saved.paidAmount, 11000)
  assert.equal(saved.settlement.payments.length, 2)
  assert.equal(saved.reminders.filter(r => r.type === 'collection' && r.status === 'pending').length, 0)
  assert.equal(saved.reminders.filter(r => r.type !== 'collection' && r.status === 'pending').length, 2)
  console.log('通过：结算后禁止增项，挂账交车后可补清尾款并关闭催收，超额收款被拦截')

  const zero = await createOrder(10000, 'pending_quality_check')
  await call('POST', `/orders/${zero.id}/quality-check`, { result: 'pass' })
  saved = await detail(zero.id)
  assert.equal(saved.settlement.actualAmount, 0)
  assert.equal(saved.settlement.status, 'paid')
  assert.equal(saved.settlement.payments.length, 0)
  await call('POST', `/orders/${zero.id}/deliver`)
  assert.equal((await detail(zero.id)).reminders.filter(r => r.type === 'collection').length, 0)
  console.log('通过：质检生成的零元账单直接结清，交车不产生零元催收')

  const manual = await createOrder(10000, 'pending_settlement')
  const manualSettlement = await call('POST', `/orders/${manual.id}/settlement`)
  assert.equal(manualSettlement.status, 'paid')
  await call('POST', `/orders/${manual.id}/settlement`, { discount: 0 })
  await call('POST', `/settlements/${manualSettlement.id}/payments`, { amount: 5000 }, 201)
  await call('POST', `/orders/${manual.id}/settlement`, { discount: 6000 }, 400)
  const adjusted = await call('POST', `/orders/${manual.id}/settlement`, { discount: 5000 })
  assert.equal(adjusted.status, 'paid')
  assert.equal(adjusted.actualAmount, 5000)
  assert.equal((await detail(manual.id)).finalAmount, 5000)
  console.log('通过：手动建账与优惠调整同步结清状态，不能将应收调到已收以下')

  const rejected = await createOrder()
  const rejectedItem = await call('POST', `/orders/${rejected.id}/additional-items`, { name: '取消项目', amount: 2000 }, 201)
  await call('PATCH', `/orders/${rejected.id}/status`, { status: 'pending_quality_check' })
  await call('POST', `/orders/${rejected.id}/quality-check`, { result: 'fail' })
  await call('PATCH', `/orders/additional-items/${rejectedItem.id}/confirm`, { confirmed: false })
  await call('PATCH', `/orders/${rejected.id}/status`, { status: 'pending_quality_check' })
  await call('POST', `/orders/${rejected.id}/quality-check`, { result: 'pass' })
  assert.equal((await detail(rejected.id)).settlement.actualAmount, 10000)
  console.log('通过：待确认增项不阻止返工，拒绝的增项不计入结算')
}

try {
  await main()
  console.log('全部结算回归用例通过 ✓')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
