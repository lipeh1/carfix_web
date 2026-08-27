import request from './request'

// 工作台统计
export const getDashboard = () => request.get('/dashboard')

// 统计报表
export const getStats = () => request.get('/stats')

// 客户
export const getCustomers = (params?: { keyword?: string }) =>
  request.get('/customers', { params })
export const getCustomer = (id: number) => request.get(`/customers/${id}`)
export const createCustomer = (data: any) => request.post('/customers', data)
export const updateCustomer = (id: number, data: any) => request.put(`/customers/${id}`, data)

// 车辆
export const getVehicles = (params?: { keyword?: string; customerId?: number }) =>
  request.get('/vehicles', { params })
export const getVehicle = (id: number) => request.get(`/vehicles/${id}`)
export const createVehicle = (data: any) => request.post('/vehicles', data)

// 工单
export const getOrders = (params?: { status?: string; keyword?: string }) =>
  request.get('/orders', { params })
export const getOrder = (id: number) => request.get(`/orders/${id}`)
export const createOrder = (data: any) => request.post('/orders', data)
export const updateOrderStatus = (id: number, status: string, data?: any) =>
  request.patch(`/orders/${id}/status`, { status, ...data })

// 接车
export const createCheckin = (data: any) => request.post('/checkin', data)
export const updateCheckin = (orderId: number, data: any) =>
  request.patch(`/orders/${orderId}/checkin`, data)

// 报价
export const getQuote = (orderId: number) => request.get(`/orders/${orderId}/quote`)
export const saveQuote = (orderId: number, data: any) =>
  request.post(`/orders/${orderId}/quote`, data)
export const confirmQuote = (orderId: number, confirmed: boolean) =>
  request.post(`/orders/${orderId}/quote/confirm`, { confirmed })

// 维修记录
export const getRepairLogs = (orderId: number) =>
  request.get(`/orders/${orderId}/repair-logs`)
export const addRepairLog = (orderId: number, content: string) =>
  request.post(`/orders/${orderId}/repair-logs`, { content })

// 增项
export const getAdditionalItems = (orderId: number) =>
  request.get(`/orders/${orderId}/additional-items`)
export const addAdditionalItem = (orderId: number, data: any) =>
  request.post(`/orders/${orderId}/additional-items`, data)
export const confirmAdditionalItem = (id: number, confirmed: boolean) =>
  request.patch(`/orders/additional-items/${id}/confirm`, { confirmed })

// 质检
export const createQualityCheck = (orderId: number, data: any) =>
  request.post(`/orders/${orderId}/quality-check`, data)

// 结算
export const getSettlement = (orderId: number) =>
  request.get(`/orders/${orderId}/settlement`)
export const createSettlement = (orderId: number, data?: any) =>
  request.post(`/orders/${orderId}/settlement`, data)
export const addPayment = (settlementId: number, data: any) =>
  request.post(`/settlements/${settlementId}/payments`, data)

// 交车
export const deliverOrder = (id: number, data: any) =>
  request.post(`/orders/${id}/deliver`, data)

// 提醒
export const getReminders = (params?: { status?: string; type?: string }) =>
  request.get('/reminders', { params })
export const updateReminder = (id: number, data: any) =>
  request.patch(`/reminders/${id}`, data)

// 上传
export const uploadImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 删除已上传的图片（按上传接口返回的 url）
export const deleteUpload = (url: string) =>
  request.delete('/upload', { params: { url } })
