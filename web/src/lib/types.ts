// 领域类型：前端各页面的接口返回数据结构（与 Prisma 模型对应，金额一律「分」）
// 供页面 useState / api 泛型使用，替代散落的 any
// 时间字段为 JSON 序列化后的 ISO 字符串（后端 DateTime 经 NextResponse.json 输出）

// ===== 客户 / 车辆 =====

export interface Customer {
  id: number
  name: string
  phone: string
  address?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  /** 客户列表附带车辆（详情/列表接口按需 include） */
  vehicles?: Vehicle[]
  /** 车辆数（Prisma _count 输出，列表接口返回） */
  _count?: { vehicles: number }
  vehicleCount?: number
  lastVisitAt?: string | null
  /** 客户详情附带：历史工单与消费统计 */
  workOrders?: WorkOrder[]
  stats?: CustomerStats
}

// 客户消费统计（客户详情接口输出）
export interface CustomerStats {
  totalOrders: number
  completedOrders: number
  totalSpent: number
  lastVisit: string | null
}

// 车辆维修统计（车辆详情接口输出）
export interface VehicleStats {
  totalRepairs: number
  totalSpent: number
  lastRepair: string | null
  /** 维修项目频次排行（前 5） */
  commonItems: { name: string; count: number }[]
}

export interface Vehicle {
  id: number
  customerId: number
  plateNumber: string
  brand?: string | null
  model?: string | null
  year?: number | null
  vin?: string | null
  color?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
  /** 车辆详情/车辆工单列表附带 */
  workOrders?: WorkOrder[]
  /** 工单数（Prisma _count 输出） */
  _count?: { workOrders: number }
  orderCount?: number
  lastServiceAt?: string | null
  /** 车辆详情附带：待办保养提醒与维修统计 */
  reminders?: Reminder[]
  stats?: VehicleStats
}

// ===== 工单 =====

// 工单状态机（与后端 allowedTransitions 对应）
export type OrderStatus =
  | 'pending_inspection' // 待检测
  | 'pending_quote' // 待报价
  | 'quoted' // 已报价待确认
  | 'confirmed' // 已确认待维修
  | 'repairing' // 维修中
  | 'pending_quality_check' // 待质检
  | 'pending_settlement' // 待结算
  | 'pending_delivery' // 待交车
  | 'completed' // 已完成
  | 'cancelled' // 已取消

export interface WorkOrder {
  id: number
  orderNo: string
  customerId: number
  vehicleId: number
  status: OrderStatus
  source: string
  complaint?: string | null
  inspection?: string | null
  mileageIn?: number | null
  mileageOut?: number | null
  quoteAmount?: number | null
  discount: number
  finalAmount?: number | null
  paidAmount: number
  quoteConfirmedAt?: string | null
  repairStartedAt?: string | null
  repairFinishedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  cancelReason?: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
  vehicle?: Vehicle
  checkinRecord?: CheckinRecord | null
  checkinPhotos?: CheckinPhoto[]
  repairItems?: RepairItem[]
  repairLogs?: RepairLog[]
  additionalItems?: AdditionalItem[]
  qualityCheck?: QualityCheck | null
  settlement?: Settlement | null
  reminders?: Reminder[]
}

export interface CheckinRecord {
  id: number
  workOrderId: number
  vehicleCondition?: string | null
  fuelLevel?: string | null
  itemsInCar?: string | null
  checkinBy?: string | null
  createdAt: string
}

export interface CheckinPhoto {
  id: number
  workOrderId: number
  filePath: string
  description?: string | null
  createdAt: string
}

// service(工时) / part(配件)；source: quote(报价) / additional(增项)
export interface RepairItem {
  id: number
  workOrderId: number
  type: 'service' | 'part' | string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  remark?: string | null
  source: 'quote' | 'additional' | string
  createdAt: string
}

export interface RepairLog {
  id: number
  workOrderId: number
  content: string
  createdAt: string
}

// 增项确认状态：pending / confirmed / rejected
export interface AdditionalItem {
  id: number
  workOrderId: number
  name: string
  amount: number
  reason?: string | null
  status: 'pending' | 'confirmed' | 'rejected' | string
  confirmedAt?: string | null
  createdAt: string
}

export interface QualityCheck {
  id: number
  workOrderId: number
  result: 'pass' | 'fail' | string
  checkItems?: string | null
  remark?: string | null
  checkedBy?: string | null
  createdAt: string
}

export interface Settlement {
  id: number
  workOrderId: number
  settlementNo: string
  totalAmount: number
  discount: number
  actualAmount: number
  paidAmount: number
  status: 'paid' | 'unpaid' | string
  remark?: string | null
  createdAt: string
  payments?: Payment[]
}

export interface Payment {
  id: number
  settlementId: number
  amount: number
  method: 'cash' | 'wechat' | 'alipay' | 'card' | 'transfer' | string
  type: 'initial' | 'supplement' | string
  remark?: string | null
  createdAt: string
}

// ===== 提醒 =====

// maintenance 保养 / follow_up 回访 / collection 催收
export interface Reminder {
  id: number
  workOrderId: number
  vehicleId: number
  type: 'maintenance' | 'follow_up' | 'collection' | string
  remindDate: string
  content?: string | null
  status: 'pending' | 'done' | string
  remindedAt?: string | null
  remindMethod?: string | null
  feedback?: string | null
  createdAt: string
  vehicle?: Vehicle
  workOrder?: WorkOrder
}

// ===== 工作台 / 统计 =====

export interface DashboardStats {
  pendingInspection: number
  repairing: number
  pendingSettlement: number
  completed: number
  monthlyRevenue: number
  unpaidAmount: number
}

// 统计报表（GET /stats）：月度趋势 + 状态分布 + 概览 + 挂账明细
export interface MonthStat {
  /** 月份，格式 YYYY-MM */
  month: string
  revenue: number
  orderCount: number
}

export interface StatusCount {
  status: OrderStatus | string
  count: number
}

// 挂账明细条目（统计接口输出，字段已拍平便于列表渲染）
export interface UnpaidOrder {
  id: number
  settlementNo: string
  totalAmount: number
  actualAmount: number
  paidAmount: number
  unpaidAmount: number
  customerName?: string | null
  plateNumber?: string | null
  orderId: number
  createdAt: string
}

export interface StatsData {
  overview: {
    customerCount: number
    vehicleCount: number
    totalOrders: number
    totalRevenue: number
    completedOrders: number
  }
  months: MonthStat[]
  statusDistribution: StatusCount[]
  /** 维修项目热度排行 */
  topItems?: { name: string; count: number; total: number }[]
  /** 挂账明细 */
  unpaid?: { total: number; count: number; list: UnpaidOrder[] }
}

// ===== OCR 识别（百度接口经后端代理，字段由后端归一化输出） =====

// 行驶证识别：预填新建客户与车辆表单
export interface VehicleLicenseOcrResult {
  plateNumber?: string
  owner?: string
  address?: string
  brandModel?: string
  vin?: string
}

// 车牌识别：number 为识别出的车牌号
export interface PlateOcrResult {
  number?: string
}

// 复制上次报价返回：历史工单 + 其报价项目（金额为分）
export interface LastQuoteData {
  order: { id: number; orderNo: string; createdAt: string }
  items: RepairItem[]
}

// ===== 通用 =====

// 表单提交载荷（字段按接口各自约定，宽松结构）
export type FormPayload = Record<string, unknown>
