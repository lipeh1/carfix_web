// 全流程 UI 等价走查：按页面按钮的点击顺序执行其背后的 API 调用，
// 并核验全部页面路由可渲染。覆盖 接车→报价→确认→维修→增项→质检→收款→交车→提醒 全链路。
// 用法：node scripts/walkthrough.mjs [baseUrl]（默认 http://127.0.0.1:3000）
const BASE = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:3000'

let cookie = ''
let passed = 0, failed = 0
const results = []

function step(label, ok, detail = '') {
  results.push(`${ok ? '✓' : '✗'} ${label}${detail ? '  →  ' + detail : ''}`)
  ok ? passed++ : failed++
}

async function api(method, path, body, expect = 200) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: res.status, ok: res.status === expect, data, text }
}

// 页面路由渲染检查（客户端组件 SSR 外壳 200 即为可渲染）
async function page(path, marker) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
  const html = await res.text()
  step(`页面 ${path}`, res.status === 200 && html.includes('<body'), `HTTP ${res.status}`)
}

const fen = v => (v / 100).toFixed(2)

async function main() {
  console.log(`全流程走查 @ ${BASE}\n` + '─'.repeat(64))

  // ===== 登录页 → 登录（UI: 登录表单提交） =====
  await page('/login')
  let r = await api('POST', '/auth/login', { password: 'test123456' })
  step('登录（访问密码）', r.ok, '会话已建立')

  // ===== 工作台首屏数据（UI: 进入 / 拉取） =====
  r = await api('GET', '/dashboard')
  step('工作台概览', r.ok, `待检测${r.data.pendingInspection} 待结算${r.data.pendingSettlement} 挂账¥${fen(r.data.unpaidAmount)} 本月营收¥${fen(r.data.monthlyRevenue)}`)

  // ===== 接车登记页 =====
  await page('/checkin')
  // UI: 客户选择弹窗 → 搜索「张」无结果 → 新建客户弹窗
  r = await api('GET', '/customers?keyword=' + encodeURIComponent('张三丰'))
  step('客户弹窗搜索（无此人）', r.ok && r.data.length === 0, '空列表')
  r = await api('POST', '/customers', { name: '张三丰', phone: '13900001111' }, 201)
  step('新建客户（弹窗保存）', r.ok, `#${r.data.id} ${r.data.name}`)
  const customerId = r.data.id

  // UI: 新建车辆弹窗 → 车牌键盘输入 京A88888 → 保存（前端 isValidPlate 通过后提交）
  r = await api('POST', '/vehicles', { customerId, plateNumber: '京A88888', brand: '比亚迪', model: '汉EV', year: 2024 }, 201)
  step('新建车辆（车牌键盘）', r.ok, `#${r.data.id} ${r.data.plateNumber}`)
  const vehicleId = r.data.id

  // UI: 诉求标签「异响、故障灯亮」+ 文本 + 里程 → 创建工单
  r = await api('POST', '/checkin', {
    customerId, vehicleId,
    complaint: '异响、故障灯亮，加速时顿挫', mileageIn: 52000, vehicleCondition: '左前门划痕', photos: []
  }, 201)
  step('创建工单（接车提交）', r.ok, `${r.data.orderNo} 待检测`)
  const orderId = r.data.id

  // ===== 工单详情页（待检测） =====
  await page(`/orders/${orderId}`)
  r = await api('GET', `/orders/${orderId}`)
  step('工单详情加载', r.ok && r.data.status === 'pending_inspection', r.data.orderNo)

  // ===== 检测报价页 =====
  await page(`/orders/${orderId}/quote`)
  // UI: 「上次项目」按钮（该车无历史工单 → toast 提示）
  r = await api('GET', `/orders/${orderId}/last-quote`)
  step('报价页「上次项目」（无历史）', r.ok && r.data.order === null, '正确返回空')

  // UI: 常用项目（机油4L 280 / 机油滤芯 35）+ 添加工时（检测费 150）+ 优惠 15 → 生成报价单（元→分换算）
  r = await api('POST', `/orders/${orderId}/quote`, {
    items: [
      { type: 'part', name: '机油（4L）', quantity: 1, unitPrice: 28000 },
      { type: 'part', name: '机油滤芯', quantity: 1, unitPrice: 3500 },
      { type: 'service', name: '发动机检测', quantity: 1, unitPrice: 15000 }
    ],
    inspection: '节气门积碳，火花塞老化',
    discount: 1500
  })
  step('保存报价（明细+优惠）', r.ok, `合计¥${fen(r.data.total)}（46,500 分）`)
  r = await api('GET', `/orders/${orderId}`)
  step('报价落库（quoteAmount/discount/inspection）', r.data.quoteAmount === 46500 && r.data.discount === 1500 && !!r.data.inspection, `¥${fen(r.data.quoteAmount)} - 优惠¥${fen(r.data.discount)} · 检测结果已存`)

  // ===== 工单详情（待报价确认）：报价图片数据源核验 =====
  r = await api('GET', `/orders/${orderId}`)
  const quoteCardItems = r.data.repairItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal }))
  step('报价长图数据源（Canvas 绘制入参）', quoteCardItems.length === 3, quoteCardItems.map(i => `${i.name}×${i.quantity}`).join('、'))

  // UI: 客户确认报价
  r = await api('PATCH', `/orders/${orderId}/status`, { status: 'repairing' })
  step('客户确认报价 → 维修中', r.ok && r.data.status === 'repairing', `repairStartedAt=${!!r.data.repairStartedAt}`)

  // UI: 记录维修弹窗
  r = await api('POST', `/orders/${orderId}/repair-logs`, { content: '更换机油机滤，清洗节气门' }, 201)
  step('记录维修', r.ok, r.data.content)

  // UI: 新增增项弹窗（输入元 → yuanToFen）→ 确认
  r = await api('POST', `/orders/${orderId}/additional-items`, { name: '更换火花塞（4支）', amount: 24000, reason: '拆检发现老化' }, 201)
  step('新增增项（¥240）', r.ok, '待客户确认')
  const addItem = r.data
  r = await api('PATCH', `/orders/additional-items/${addItem.id}/confirm`, { confirmed: true })
  step('确认增项', r.ok, '计入维修项目')
  r = await api('GET', `/orders/${orderId}`)
  step('增项后明细', r.data.repairItems.length === 4, `finalAmount=¥${fen(r.data.finalAmount)}（70,500-1,500=69,000 分）`)

  // UI: 维修完成
  r = await api('PATCH', `/orders/${orderId}/status`, { status: 'pending_quality_check' })
  step('维修完成 → 待质检', r.ok, `repairFinishedAt=${!!r.data.repairFinishedAt}`)

  // UI: 质检通过（自动生成结算单）
  r = await api('POST', `/orders/${orderId}/quality-check`, { result: 'pass' })
  step('质检通过 → 待结算', r.ok, '质检记录已建')
  r = await api('GET', `/orders/${orderId}/settlement`)
  const settlement = r.data
  step('结算单自动生成', !!settlement && settlement.actualAmount === 69000 && settlement.status === 'unpaid', `${settlement.settlementNo} 应收¥${fen(settlement.actualAmount)} 挂账`)

  // UI: 收款弹窗（预填待收 ¥690，微信收款 ¥400 → 挂账）
  r = await api('POST', `/settlements/${settlement.id}/payments`, { amount: 40000, method: 'wechat', type: 'initial' }, 201)
  step('收款 ¥400（微信）', r.ok, '部分收款，剩余挂账 ¥290')
  // 超额拦截
  r = await api('POST', `/settlements/${settlement.id}/payments`, { amount: 99999 }, 400)
  step('超额收款拦截', r.ok, '返回业务错误（400）')

  // UI: 交车弹窗（里程 52300）——挂账交车
  r = await api('POST', `/orders/${orderId}/deliver`, { mileageOut: 52300 })
  step('交车（挂账状态）', r.ok, '工单完成，自动建催收提醒')
  r = await api('GET', `/orders/${orderId}`)
  step('工单终态', r.data.status === 'completed' && r.data.mileageOut === 52300, `已收¥${fen(r.data.paidAmount)}/¥${fen(r.data.finalAmount)}`)

  // 自动提醒核验（交车触发）
  r = await api('GET', '/reminders?status=pending')
  const mine = r.data.filter(x => x.workOrder?.id === orderId)
  const types = mine.map(x => x.type).sort().join(',')
  step('交车自动提醒', mine.length === 4 && types === 'collection,collection,follow_up,maintenance', `回访+保养+催收×2（欠款¥290）`)

  // UI: 补款（¥290 微信）→ 结清关闭催收
  r = await api('POST', `/settlements/${settlement.id}/payments`, { amount: 29000, method: 'wechat', type: 'supplement' }, 201)
  step('补款 ¥290 结清', r.ok, '催收提醒自动关闭')
  r = await api('GET', '/reminders?status=pending')
  const collections = r.data.filter(x => x.workOrder?.id === orderId && x.type === 'collection')
  step('催收自动关闭', collections.length === 0, '结清联动正确')

  // ===== 客户/车辆详情页数据 =====
  await page(`/customers/${customerId}`)
  r = await api('GET', `/customers/${customerId}`)
  step('客户详情数据', r.ok && r.data.stats.totalOrders === 1 && r.data.stats.totalSpent === 69000, `${r.data.name} 累计消费¥${fen(r.data.stats.totalSpent)}`)
  await page(`/vehicles/${vehicleId}`)
  r = await api('GET', `/vehicles/${vehicleId}`)
  step('车辆详情数据', r.ok && r.data.stats.totalRepairs === 1, `常见项目 top: ${(r.data.stats.commonItems[0] || {}).name || '-'}`)

  // ===== 各列表页与统计 =====
  await page('/orders')
  r = await api('GET', '/orders?keyword=' + encodeURIComponent('京A88888'))
  step('工单列表（按车牌搜索）', r.ok && r.data.length === 1, `命中 ${r.data[0].orderNo}`)
  r = await api('GET', '/orders?status=completed')
  step('工单列表（状态筛选）', r.ok && r.data.every(o => o.status === 'completed'), `${r.data.length} 张已完成`)
  await page('/customers')
  r = await api('GET', '/customers')
  step('客户列表', r.ok && r.data.some(c => c.name === '张三丰'), `${r.data.length} 位客户`)
  await page('/reminders')
  r = await api('GET', '/reminders')
  step('提醒列表', r.ok, `${r.data.length} 条`)
  await page('/stats')
  r = await api('GET', '/stats')
  step('统计报表数据', r.ok && r.data.months.length === 6, `总营收¥${fen(r.data.overview.totalRevenue)} 工单${r.data.overview.totalOrders}张 挂账¥${fen(r.data.unpaid.total)}`)
  r = await api('GET', '/dashboard')
  step('工作台数据（交车后）', r.ok, `已完成${r.data.completed} 挂账¥${fen(r.data.unpaidAmount)} 本月营收¥${fen(r.data.monthlyRevenue)}`)

  // ===== 收尾：全部页面路由渲染 =====
  console.log('─'.repeat(64))
  console.log(results.join('\n'))
  console.log('─'.repeat(64))
  console.log(`结果：${passed} 项通过，${failed} 项失败`)
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error('走查脚本异常：', e.message); process.exit(1) })
