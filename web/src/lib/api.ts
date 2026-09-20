// 全部业务接口（与旧 client/src/api/index.ts 一一对应，字段语义不变）
import { http } from './api-client'

// 工作台统计
export const getDashboard = () => http.get('/dashboard')

// 统计报表
export const getStats = () => http.get('/stats')

// 客户
export const getCustomers = (params?: { keyword?: string }) => http.get('/customers', { params })
export const getCustomer = (id: number) => http.get(`/customers/${id}`)
export const createCustomer = (data: any) => http.post('/customers', data)
export const updateCustomer = (id: number, data: any) => http.put(`/customers/${id}`, data)

// 车辆
export const getVehicles = (params?: { keyword?: string; customerId?: number }) =>
  http.get('/vehicles', { params })
export const getVehicle = (id: number) => http.get(`/vehicles/${id}`)
export const createVehicle = (data: any) => http.post('/vehicles', data)

// 工单
export const getOrders = (params?: { status?: string; keyword?: string }) =>
  http.get('/orders', { params })
export const getOrder = (id: number) => http.get(`/orders/${id}`)
export const createOrder = (data: any) => http.post('/orders', data)
export const updateOrderStatus = (id: number, status: string, data?: any) =>
  http.patch(`/orders/${id}/status`, { status, ...data })

// 接车
export const createCheckin = (data: any) => http.post('/checkin', data)
export const updateCheckin = (orderId: number, data: any) =>
  http.patch(`/orders/${orderId}/checkin`, data)

// 报价
export const getQuote = (orderId: number) => http.get(`/orders/${orderId}/quote`)
export const saveQuote = (orderId: number, data: any) =>
  http.post(`/orders/${orderId}/quote`, data)
export const confirmQuote = (orderId: number, confirmed: boolean) =>
  http.post(`/orders/${orderId}/quote/confirm`, { confirmed })
// 这辆车上次已完成工单的报价项目（复制上次项目）
export const getLastQuote = (orderId: number) => http.get(`/orders/${orderId}/last-quote`)

// 维修记录
export const getRepairLogs = (orderId: number) => http.get(`/orders/${orderId}/repair-logs`)
export const addRepairLog = (orderId: number, content: string) =>
  http.post(`/orders/${orderId}/repair-logs`, { content })

// 增项
export const getAdditionalItems = (orderId: number) =>
  http.get(`/orders/${orderId}/additional-items`)
export const addAdditionalItem = (orderId: number, data: any) =>
  http.post(`/orders/${orderId}/additional-items`, data)
export const confirmAdditionalItem = (id: number, confirmed: boolean) =>
  http.patch(`/orders/additional-items/${id}/confirm`, { confirmed })

// 质检
export const createQualityCheck = (orderId: number, data: any) =>
  http.post(`/orders/${orderId}/quality-check`, data)

// 结算
export const getSettlement = (orderId: number) => http.get(`/orders/${orderId}/settlement`)
export const createSettlement = (orderId: number, data?: any) =>
  http.post(`/orders/${orderId}/settlement`, data)
export const addPayment = (settlementId: number, data: any) =>
  http.post(`/settlements/${settlementId}/payments`, data)

// 交车
export const deliverOrder = (id: number, data: any) => http.post(`/orders/${id}/deliver`, data)

// 提醒
export const getReminders = (params?: { status?: string; type?: string }) =>
  http.get('/reminders', { params })
export const updateReminder = (id: number, data: any) => http.patch(`/reminders/${id}`, data)

// ===== 图片上传（Vercel Blob 客户端直传） =====
// 流程：POST handleUploadUrl 由服务端下发短时 token，浏览器拿到后直传 Blob，
// 返回公开随机 URL（路径含随机后缀，不可猜测）
import { upload } from '@vercel/blob/client'

export async function uploadImage(file: File): Promise<{ url: string }> {
  // 保留原始扩展名，命名规则与旧版 multer 一致（时间戳-随机数），归入 checkin/ 目录便于管理
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const pathname = `checkin/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  return upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload/token'
  })
}

// 删除已上传的图片（按上传返回的完整 Blob URL）
export const deleteUpload = (url: string) => http.delete('/upload', { params: { url } })

// ===== OCR 识别（后端代理百度） =====
// File 转 base64（去 data: 前缀）
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsDataURL(file)
})

// 行驶证识别
export async function ocrVehicleLicense(file: File) {
  const image = await fileToBase64(file)
  return http.post('/ocr/vehicle-license', { image })
}

// 车牌识别
export async function ocrPlate(file: File) {
  const image = await fileToBase64(file)
  return http.post('/ocr/plate', { image })
}

// 访问控制
export const getAuthStatus = () => http.get('/auth/status')
// 会话探测：401 属预期情况（未登录），标记 skipToast 不弹全局错误提示
export const getAuthMe = () => http.get('/auth/me', { skipToast: true })
export const setupPassword = (data: { password: string }) => http.post('/auth/setup', data)
export const loginPassword = (data: { password: string }) => http.post('/auth/login', data)
export const logout = () => http.post('/auth/logout')
export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  http.post('/auth/password', data)
