// Vercel Blob 客户端直传：本路由下发短时上传凭证
// 浏览器经 @vercel/blob/client 的 upload() 直传 Blob（绕开 Serverless 请求体大小限制），
// 服务端在此校验文件类型与大小后生成受约束的 client token
import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { withAuth, errorResponse } from '@/lib/api-helpers'

export const POST = withAuth(async (req: NextRequest) => {
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async pathname => {
        // 与旧版 multer 一致的约束：仅图片、单文件 10MB
        const allowed = /\.(jpe?g|png|gif|webp)$/i
        if (!allowed.test(pathname)) {
          throw new Error('只支持图片文件')
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true
        }
      },
      // 上传完成回调需要公网 webhook，本地/无域名场景跳过；
      // 直传结果由浏览器拿到 URL 后随接车提交落库，无孤儿校验需求
      onUploadCompleted: async () => {}
    })

    return NextResponse.json(jsonResponse)
  } catch (e) {
    return errorResponse(e instanceof Error ? e : new Error('上传凭证生成失败'))
  }
})
