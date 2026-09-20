// 工单状态与提醒类型的展示映射 + 日期金额格式化
// （收拢旧版在 4 个页面重复定义的 statusMap，后续页面统一引用）
import dayjs from 'dayjs'

// 工单状态 → 标签与语义色（语义色仅用于小面积徽章，符合 UI 规范）
export const ORDER_STATUS_MAP: Record<string, { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'default' }> = {
  pending_inspection: { label: '待检测', tone: 'warning' },
  pending_quote: { label: '待报价', tone: 'primary' },
  repairing: { label: '维修中', tone: 'danger' },
  pending_quality_check: { label: '待质检', tone: 'warning' },
  pending_settlement: { label: '待结算', tone: 'primary' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'default' }
}

export const getOrderStatusLabel = (s: string) => ORDER_STATUS_MAP[s]?.label || s
export const getOrderStatusTone = (s: string) => ORDER_STATUS_MAP[s]?.tone || 'default'

// 提醒类型标签（含挂账交车自动生成的催收提醒）
export const REMINDER_TYPE_LABELS: Record<string, string> = {
  maintenance: '保养提醒',
  follow_up: '回访提醒',
  collection: '催收提醒'
}
export const getReminderTypeLabel = (t: string) => REMINDER_TYPE_LABELS[t] || '提醒'

export const formatDate = (d?: string | Date | null) => dayjs(d || undefined).format('YYYY-MM-DD')
export const formatDateTime = (d?: string | Date | null) => dayjs(d || undefined).format('YYYY-MM-DD HH:mm')
export const formatMonthDay = (d?: string | Date | null) => dayjs(d || undefined).format('MM-DD')

// 收款方式标签
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '刷卡',
  transfer: '转账'
}
export const getPaymentMethodLabel = (m: string) => PAYMENT_METHOD_LABELS[m] || m
