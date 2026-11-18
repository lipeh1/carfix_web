'use client'

// 报价单分享图：把工单报价绘制成一张长图（JPEG dataURL），
// 供微信发送客户确认；浅色纸面与应用字体保持一致，金额使用等宽字体
// 所有金额入参为「分」，绘制时换算为元
import { resolveShopName } from '@/lib/shop'

export interface QuoteCardItem {
  name: string
  type: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface QuoteCardOrder {
  orderNo: string
  plateNumber?: string
  customerName?: string
  mileageIn?: number | null
  createdAt: string
  quoteAmount?: number | null
  discount?: number
  repairItems: QuoteCardItem[]
}

const fen = (v: number | null | undefined) => ((Number(v) || 0) / 100).toFixed(2)

// 店名存服务端（全局设置），绘制前异步取缓存（首次自动拉取，失败回退默认名）
export async function generateQuoteCard(order: QuoteCardOrder): Promise<string> {
  const W = 720
  const PAD = 44
  const items = order.repairItems || []

  // 高度按项目数自适应（长图）
  const headerH = 230
  const rowH = 54
  const summaryH = 190
  const footerH = 70
  const H = headerH + Math.max(items.length, 1) * rowH + summaryH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const theme = getComputedStyle(document.documentElement)
  const FONT = theme.getPropertyValue('--type-sans').trim()
  const MONO = theme.getPropertyValue('--type-mono').trim()
  const color = (name: string) => theme.getPropertyValue(`--document-${name}`).trim()

  // Canvas 不会触发 CSS 字体子集加载，先准备本张单据需要的字符，避免导出时回退系统字体
  const shopName = await resolveShopName()
  const fontText = [shopName, order.plateNumber, order.customerName, order.orderNo,
    ...items.map(item => item.name),
    '维修报价单未知车牌客户里程工单暂无项目项目合计优惠应收报价如有疑问请随时联系确认后我们将尽快安排施工0123456789.¥×（）：·-km'
  ].join('')
  await Promise.all([FONT, MONO].flatMap(family => [400, 500, 600].map(weight =>
    document.fonts.load(`${weight} 24px ${family}`, fontText)
  )))

  // 纸面底色
  ctx.fillStyle = color('paper')
  ctx.fillRect(0, 0, W, H)

  // ===== 页眉：店名 + 单据类型 =====
  ctx.fillStyle = color('ink')
  ctx.font = `600 34px ${FONT}`
  ctx.textBaseline = 'top'
  ctx.fillText(shopName, PAD, 44)

  ctx.fillStyle = color('accent')
  ctx.font = `500 26px ${FONT}`
  const typeLabel = '维修报价单'
  ctx.fillText(typeLabel, W - PAD - ctx.measureText(typeLabel).width, 50)

  // ===== 车辆标识块（沿用单据的中性纸面）=====
  const plate = (order.plateNumber || '未知车牌').toUpperCase()
  ctx.fillStyle = color('row')
  const plateW = Math.max(300, ctx.measureText(plate).width + 120)
  const plateH = 66
  const plateY = 108
  // 圆角矩形
  roundRect(ctx, PAD, plateY, plateW, plateH, 4)
  ctx.fill()
  ctx.fillStyle = color('ink')
  ctx.font = `600 34px ${MONO}`
  ctx.fillText(plate, PAD + 28, plateY + 15)

  // 客户/工单/日期元信息
  const metaY = plateY + plateH + 18
  ctx.fillStyle = color('muted')
  ctx.font = `400 22px ${FONT}`
  const dateStr = new Date(order.createdAt).toLocaleDateString('zh-CN')
  const mileageStr = order.mileageIn ? `${order.mileageIn} km` : ''
  const metaParts = [
    order.customerName ? `客户：${order.customerName}` : '',
    mileageStr ? `里程：${mileageStr}` : '',
    `工单：${order.orderNo}`,
    dateStr
  ].filter(Boolean)
  ctx.fillText(metaParts.join('　'), PAD, metaY)

  // 分割线
  const lineY = headerH - 14
  ctx.strokeStyle = color('rule')
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, lineY)
  ctx.lineTo(W - PAD, lineY)
  ctx.stroke()

  // ===== 项目明细 =====
  let y = lineY + 22
  if (items.length === 0) {
    ctx.fillStyle = color('subtle')
    ctx.font = `400 24px ${FONT}`
    ctx.fillText('（暂无项目）', PAD, y)
    y += rowH
  }
  items.forEach((it, idx) => {
    // 斑马纹提升长图可读性
    if (idx % 2 === 1) {
      ctx.fillStyle = color('row')
      ctx.fillRect(PAD - 12, y - 6, W - (PAD - 12) * 2, rowH)
    }
    ctx.fillStyle = color('ink')
    ctx.font = `400 25px ${FONT}`
    ctx.fillText(it.name, PAD, y)

    ctx.fillStyle = color('subtle')
    ctx.font = `400 21px ${MONO}`
    const spec = `${it.quantity} × ¥${fen(it.unitPrice)}`
    ctx.fillText(spec, W - PAD - 220, y + 3)

    ctx.fillStyle = color('ink')
    ctx.font = `500 25px ${MONO}`
    const sub = `¥${fen(it.subtotal)}`
    ctx.fillText(sub, W - PAD - ctx.measureText(sub).width, y)
    y += rowH
  })

  // ===== 汇总 =====
  y += 10
  ctx.strokeStyle = color('rule')
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 24

  const total = items.reduce((s, i) => s + i.subtotal, 0)
  const discount = Number(order.discount) || 0

  ctx.textAlign = 'right'
  ctx.fillStyle = color('muted')
  ctx.font = `400 24px ${MONO}`
  ctx.fillText(`项目合计　¥${fen(total)}`, W - PAD, y)
  y += 40
  if (discount > 0) {
    ctx.fillStyle = color('success')
    ctx.fillText(`优惠　-¥${fen(discount)}`, W - PAD, y)
    y += 40
  }
  ctx.fillStyle = color('ink')
  ctx.font = `600 34px ${MONO}`
  ctx.fillText(`应收　¥${fen(total - discount)}`, W - PAD, y)
  ctx.textAlign = 'left'

  // ===== 页脚 =====
  ctx.fillStyle = color('subtle')
  ctx.font = `400 20px ${FONT}`
  ctx.fillText('报价如有疑问请随时联系 · 确认后我们将尽快安排施工', PAD, H - footerH + 6)

  // 部分手机浏览器 canvas 超限/被回收时 toDataURL 返回 "data:," 而不报错，
  // 主动校验导出结果，避免展示空白图
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  if (!dataUrl || dataUrl.length < 100) {
    throw new Error('画布导出为空，请重试')
  }
  return dataUrl
}

// 绘制圆角矩形路径
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
