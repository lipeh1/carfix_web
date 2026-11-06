// 图片上传/删除接口：服务端接收 multipart 后写入存储层（COS 或本地磁盘）
// 迁移说明：原实现为 Vercel Blob 客户端直传（绕开 Serverless 4.5MB 请求体限制），
// 云托管无此限制，改为服务端中转更简单：少一次令牌下发、少一个公开回调入口
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'
import { putImage, removeImageByUrl, resolveExt } from '@/lib/storage'

// 单文件上限 10MB，与前端压缩后的体积（长边 1600px / JPEG 0.8）匹配
const MAX_SIZE = 10 * 1024 * 1024

export const POST = withAuth(async (req: NextRequest) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new AppError('请求体格式错误，需 multipart/form-data')

  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError('缺少文件字段 file')
  if (!file.type.startsWith('image/')) throw new AppError('只支持图片文件')
  if (file.size > MAX_SIZE) throw new AppError('图片大小不能超过 10MB')

  // 扩展名以文件名优先、MIME 兜底，非法类型在 resolveExt 内抛错
  const ext = resolveExt(file.name, file.type)
  const buffer = Buffer.from(await file.arrayBuffer())
  const { url } = await putImage(buffer, ext)

  return NextResponse.json({ url })
})

// 删除已上传的图片（用户在上传列表中移除照片时调用，避免存储残留孤儿文件）
export const DELETE = withAuth(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get('url') || ''
  if (!url) throw new AppError('缺少文件地址')
  // 合法性校验（仅 checkin/ 目录、命名合规）在 removeImageByUrl 内部完成
  await removeImageByUrl(url)
  return NextResponse.json({ success: true })
})
