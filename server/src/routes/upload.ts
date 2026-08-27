import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { asyncHandler, AppError } from '../middleware/error'

const router = Router()

// 确保上传目录存在
const uploadDir = path.resolve(__dirname, '../../../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/i
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片文件'))
    }
  }
})

// 单张图片上传
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择文件' })
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ url, filename: req.file.filename, size: req.file.size })
}))

// 多张图片上传
router.post('/multiple', upload.array('files', 9), asyncHandler(async (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ message: '请选择文件' })
  }
  const urls = (req.files as Express.Multer.File[]).map(f => ({
    url: `/uploads/${f.filename}`,
    filename: f.filename,
    size: f.size
  }))
  res.json(urls)
}))

// 删除已上传的图片（用户在上传列表中移除照片时调用，避免服务器残留孤儿文件）
router.delete('/', asyncHandler(async (req, res) => {
  const url = String(req.query.url || '')
  // 仅接受本服务 /uploads/ 前缀的地址
  if (!url.startsWith('/uploads/')) throw new AppError('非法的文件地址')
  // 只取路径最后一段做文件名，阻断目录穿越；且必须匹配本服务生成的命名格式
  const filename = path.basename(url)
  if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    throw new AppError('非法的文件名')
  }
  const filePath = path.join(uploadDir, filename)
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath)
  }
  res.json({ success: true })
}))

export default router
