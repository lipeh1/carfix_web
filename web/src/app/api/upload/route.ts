// 删除已上传的 Blob 图片（用户在上传列表中移除照片时调用，避免存储残留孤儿文件）
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { AppError } from '@/lib/errors'
import { withAuth } from '@/lib/api-helpers'

export const DELETE = withAuth(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get('url') || ''
  // 仅接受本系统 Blob 存储地址，且路径必须位于 checkin/ 目录下
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError('非法的文件地址')
  }
  if (!parsed.pathname.startsWith('/checkin/')) throw new AppError('非法的文件地址')
  // 文件名必须匹配本系统生成的命名格式（时间戳-随机串.图片扩展名），阻断任意删除
  const filename = parsed.pathname.split('/').pop() ?? ''
  if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    throw new AppError('非法的文件名')
  }
  await del(url)
  return NextResponse.json({ success: true })
})
