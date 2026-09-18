// 结算流程回归：使用临时数据库和真实路由，验证增项、挂账补款及零元结算。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const express = require('express')

// 直接在内存加载源码，不生成构建产物；兼容项目当前使用的 Node 16。
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  })
  module._compile(result.outputText, filename)
}

async function main() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carweb-settlement-'))
  // 预建空文件供 Windows 上的迁移引擎打开，表结构仍完全由迁移生成。
  fs.closeSync(fs.openSync(path.join(testDir, 'test.db'), 'wx'))
  process.env.DATABASE_URL = `file:${path.join(testDir, 'test.db').replace(/\\/g, '/')}`
  let prisma
  let server
  try {
    // 仅对刚创建的临时库应用现有迁移，绝不访问业务数据库。
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'pipe'
    })
    prisma = require('../src/prisma.ts').default
    const app = express()
    app.use(express.json())
    app.use('/orders', require('../src/routes/orders.ts').default)
    app.use('/settlements', require('../src/routes/settlements.ts').default)
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }))
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const call = (method, url, body = {}, expectedStatus = 200) => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port, path: url, method,
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        let output = ''
        res.on('data', chunk => { output += chunk })
        res.on('end', () => {
          try {
            assert.equal(res.statusCode, expectedStatus, `${method} ${url}: ${output}`)
            resolve(JSON.parse(output))
          } catch (error) { reject(error) }
        })
      })
      req.on('error', reject)
      req.end(JSON.stringify(body))
    })
    const customer = await prisma.customer.create({ data: { name: '回归测试', phone: '13800000000' } })
    const vehicle = await prisma.vehicle.create({ data: { customerId: customer.id, plateNumber: '测A12345' } })
    let orderIndex = 0
    const createOrder = (discount = 0, status = 'repairing') => prisma.workOrder.create({ data: {
      orderNo: `TEST${++orderIndex}`, customerId: customer.id, vehicleId: vehicle.id, status, discount,
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
    // 模拟旧版本留下的待确认增项，验证结算后不能再改变收费明细。
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
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (prisma) await prisma.$disconnect()
    // 仅清理本测试通过系统临时目录创建的独立目录。
    fs.rmSync(testDir, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error.stdout?.toString() || '', error.stderr?.toString() || '', error.message)
  process.exitCode = 1
})
