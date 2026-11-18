// 全部业务接口（与旧 client/src/api/index.ts 一一对应，字段语义不变）
// 返回结构类型见 lib/types.ts
import { http } from './api-client'
import type {
  Customer, Vehicle, WorkOrder, Reminder, DashboardStats, StatsData, Settlement, Payment,
  RepairItem, RepairLog, AdditionalItem, FormPayload, VehicleLicenseOcrResult, PlateOcrResult,
  LastQuoteData
} from './types'

// 工作台统计
export const getDashboard = () => http.get<DashboardStats>('/dashboard')

// 统计报表
export const getStats = () => http.get<StatsData>('/stats')

// 客户
export const getCustomers = (params?: { keyword?: string }) =>
  http.get<Customer[]>('/customers', { params })
export const getCustomer = (id: number) => http.get<Customer>(`/customers/${id}`)
export const createCustomer = (data: FormPayload) => http.post<Customer>('/customers', data)
export const updateCustomer = (id: number, data: FormPayload) => http.put(`/customers/${id}`, data)

// 车辆
export const getVehicles = (params?: { keyword?: string; customerId?: number }) =>
  http.get<Vehicle[]>('/vehicles', { params })
export const getVehicle = (id: number) => http.get<Vehicle>(`/vehicles/${id}`)
export const createVehicle = (data: FormPayload) => http.post<Vehicle>('/vehicles', data)

// 工单
export const getOrders = (params?: { status?: string; keyword?: string }) =>
  http.get<WorkOrder[]>('/orders', { params })
export const getOrder = (id: number) => http.get<WorkOrder>(`/orders/${id}`)
export const createOrder = (data: FormPayload) => http.post<WorkOrder>('/orders', data)
export const updateOrderStatus = (id: number, status: string, data?: FormPayload) =>
  http.patch(`/orders/${id}/status`, { status, ...data })

// 接车
export const createCheckin = (data: FormPayload) => http.post<WorkOrder>('/checkin', data)
export const updateCheckin = (orderId: number, data: FormPayload) =>
  http.patch(`/orders/${orderId}/checkin`, data)

// 报价
export const getQuote = (orderId: number) => http.get<RepairItem[]>(`/orders/${orderId}/quote`)
export const saveQuote = (orderId: number, data: FormPayload) =>
  http.post(`/orders/${orderId}/quote`, data)
export const confirmQuote = (orderId: number, confirmed: boolean) =>
  http.post(`/orders/${orderId}/quote/confirm`, { confirmed })
// 这辆车上次已完成工单的报价项目（复制上次项目）
export const getLastQuote = (orderId: number) =>
  http.get<LastQuoteData>(`/orders/${orderId}/last-quote`)

// 维修记录
export const getRepairLogs = (orderId: number) =>
  http.get<RepairLog[]>(`/orders/${orderId}/repair-logs`)
export const addRepairLog = (orderId: number, content: string) =>
  http.post(`/orders/${orderId}/repair-logs`, { content })

// 增项
export const getAdditionalItems = (orderId: number) =>
  http.get<AdditionalItem[]>(`/orders/${orderId}/additional-items`)
export const addAdditionalItem = (orderId: number, data: FormPayload) =>
  http.post<AdditionalItem>(`/orders/${orderId}/additional-items`, data)
export const confirmAdditionalItem = (id: number, confirmed: boolean) =>
  http.patch(`/orders/additional-items/${id}/confirm`, { confirmed })

// 质检
export const createQualityCheck = (orderId: number, data: FormPayload) =>
  http.post(`/orders/${orderId}/quality-check`, data)

// 结算
export const getSettlement = (orderId: number) =>
  http.get<Settlement>(`/orders/${orderId}/settlement`)
export const createSettlement = (orderId: number, data?: FormPayload) =>
  http.post<Settlement>(`/orders/${orderId}/settlement`, data)
export const addPayment = (settlementId: number, data: FormPayload) =>
  http.post<Payment>(`/settlements/${settlementId}/payments`, data)

// 交车
export const deliverOrder = (id: number, data: FormPayload) => http.post(`/orders/${id}/deliver`, data)

// 提醒
export const getReminders = (params?: { status?: string; type?: string }) =>
  http.get<Reminder[]>('/reminders', { params })
export const updateReminder = (id: number, data: FormPayload) =>
  http.patch(`/reminders/${id}`, data)

// ===== 图片上传（服务端中转，落 COS 或本地磁盘） =====
// 前端只负责把压缩后的文件 POST 上来，具体存储厂商由后端 lib/storage 屏蔽；
// 超时放宽到 60s：弱网下 10MB 图片上传容易超过默认 15s
export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file, file.name)
  return http.post<{ url: string }>('/upload', form, { timeout: 60000 })
}

// 删除已上传的图片（按上传返回的完整 URL，后端按 URL 反解存储键）
export const deleteUpload = (url: string) => http.delete('/upload', { params: { url } })

// ===== OCR 识别（后端代理视觉 Agent，密钥不进入浏览器） =====
// File 转 base64（去 data: 前缀）
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsDataURL(file)
})

// 行驶证识别（后端归一化输出结构化字段）
export async function ocrVehicleLicense(file: File) {
  const image = await fileToBase64(file)
  // 图片模型处理时间较长，前端等待时间略长于服务端的 45 秒上限
  return http.post<VehicleLicenseOcrResult>('/ocr/vehicle-license', { image }, { timeout: 60000 })
}

// 车牌识别
export async function ocrPlate(file: File) {
  const image = await fileToBase64(file)
  return http.post<PlateOcrResult>('/ocr/plate', { image }, { timeout: 60000 })
}

// 访问控制
export const getAuthStatus = () => http.get<{ initialized: boolean }>('/auth/status')
// 会话探测：401 属预期情况（未登录），标记 skipToast 不弹全局错误提示
export const getAuthMe = () => http.get('/auth/me', { skipToast: true })
export const setupPassword = (data: { password: string }) =>
  http.post<{ recoveryCode: string }>('/auth/setup', data)
export const loginPassword = (data: { password: string }) => http.post('/auth/login', data)
export const logout = () => http.post('/auth/logout')
export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  http.post<{ recoveryCode: string }>('/auth/password', data)
// 忘记密码：凭恢复码重设密码并直接登录（响应含新恢复码，只显示一次）
export const recoverPassword = (data: { code: string; newPassword: string }) =>
  http.post<{ recoveryCode: string }>('/auth/recover', data)
// 重新生成恢复码（需登录）：旧的立即作废，响应含新码
export const regenerateRecoveryCode = () => http.post<{ recoveryCode: string }>('/auth/recovery-code')

// 店铺名称（全局设置，存服务端）：读取未设置返回空串，保存空串即回退默认名
export const getShopName = () => http.get<{ shopName: string }>('/settings/shop-name')
export const saveShopName = (shopName: string) => http.put<{ shopName: string }>('/settings/shop-name', { shopName })
