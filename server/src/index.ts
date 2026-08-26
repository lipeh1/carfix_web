import express from 'express'
import cors from 'cors'
import path from 'path'
import { errorHandler } from './middleware/error'
import dashboardRoutes from './routes/dashboard'
import customerRoutes from './routes/customers'
import vehicleRoutes from './routes/vehicles'
import orderRoutes from './routes/orders'
import checkinRoutes from './routes/checkin'
import reminderRoutes from './routes/reminders'
import uploadRoutes from './routes/upload'
import settlementRoutes from './routes/settlements'
import statsRoutes from './routes/stats'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件：上传的图片
const uploadDir = path.resolve(__dirname, '../../uploads')
app.use('/uploads', express.static(uploadDir))

// API 路由
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/checkin', checkinRoutes)
app.use('/api/reminders', reminderRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/settlements', settlementRoutes)
app.use('/api/stats', statsRoutes)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 错误处理
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚗 汽修管理系统 API 已启动: http://localhost:${PORT}`)
})
