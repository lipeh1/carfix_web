// 报价单分享图：把工单报价绘制成一张长图（JPEG dataURL），
// 供微信发送客户确认；浅色纸面风格，金额沿用主色强调
// 所有金额入参为"分"，绘制时换算为元

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

// 店铺名：localStorage 可配（设置入口后续再做，先读默认）
const getShopName = () => {
  try {
    return localStorage.getItem('carweb:shopName') || '汽修服务中心'
  } catch {
    return '汽修服务中心'
  }
}

const fen = (v: number | null | undefined) => ((Number(v) || 0) / 100).toFixed(2)

export function generateQuoteCard(order: QuoteCardOrder): string {
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
  const FONT = "'PingFang SC','Microsoft YaHei',sans-serif"

  // 纸面底色
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ===== 页眉：店名 + 单据类型 =====
  ctx.fillStyle = '#111214'
  ctx.font = `600 34px ${FONT}`
  ctx.textBaseline = 'top'
  ctx.fillText(getShopName(), PAD, 44)

  ctx.fillStyle = '#5e6ad2'
  ctx.font = `500 26px ${FONT}`
  const typeLabel = '维修报价单'
  ctx.fillText(typeLabel, W - PAD - ctx.measureText(typeLabel).width, 50)

  // ===== 车牌块（模拟蓝牌观感）=====
  const plate = (order.plateNumber || '未知车牌').toUpperCase()
  ctx.fillStyle = '#2b5fdf'
  const plateW = Math.max(300, ctx.measureText(plate).width + 120)
  const plateH = 66
  const plateY = 108
  // 圆角矩形
  roundRect(ctx, PAD, plateY, plateW, plateH, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 34px ${FONT}`
  ctx.fillText(plate, PAD + 28, plateY + 15)

  // 客户/工单/日期元信息
  const metaY = plateY + plateH + 18
  ctx.fillStyle = '#5f6570'
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
  ctx.strokeStyle = '#e8eaee'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, lineY)
  ctx.lineTo(W - PAD, lineY)
  ctx.stroke()

  // ===== 项目明细 =====
  let y = lineY + 22
  if (items.length === 0) {
    ctx.fillStyle = '#9aa0aa'
    ctx.font = `400 24px ${FONT}`
    ctx.fillText('（暂无项目）', PAD, y)
    y += rowH
  }
  items.forEach((it, idx) => {
    // 斑马纹提升长图可读性
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f7f8fa'
      ctx.fillRect(PAD - 12, y - 6, W - (PAD - 12) * 2, rowH)
    }
    ctx.fillStyle = '#111214'
    ctx.font = `400 25px ${FONT}`
    ctx.fillText(it.name, PAD, y)

    ctx.fillStyle = '#7a808a'
    ctx.font = `400 21px ${FONT}`
    const spec = `${it.quantity} × ¥${fen(it.unitPrice)}`
    ctx.fillText(spec, W - PAD - 220, y + 3)

    ctx.fillStyle = '#111214'
    ctx.font = `500 25px ${FONT}`
    const sub = `¥${fen(it.subtotal)}`
    ctx.fillText(sub, W - PAD - ctx.measureText(sub).width, y)
    y += rowH
  })

  // ===== 汇总 =====
  y += 10
  ctx.strokeStyle = '#e8eaee'
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 24

  const total = items.reduce((s, i) => s + i.subtotal, 0)
  const discount = Number(order.discount) || 0

  ctx.textAlign = 'right'
  ctx.fillStyle = '#5f6570'
  ctx.font = `400 24px ${FONT}`
  ctx.fillText(`项目合计　¥${fen(total)}`, W - PAD, y)
  y += 40
  if (discount > 0) {
    ctx.fillStyle = '#27a644'
    ctx.fillText(`优惠　-¥${fen(discount)}`, W - PAD, y)
    y += 40
  }
  ctx.fillStyle = '#111214'
  ctx.font = `600 34px ${FONT}`
  ctx.fillText(`应收　¥${fen(total - discount)}`, W - PAD, y)
  ctx.textAlign = 'left'

  // ===== 页脚 =====
  ctx.fillStyle = '#9aa0aa'
  ctx.font = `400 20px ${FONT}`
  ctx.fillText('报价如有疑问请随时联系 · 确认后我们将尽快安排施工', PAD, H - footerH + 6)

  return canvas.toDataURL('image/jpeg', 0.92)
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
