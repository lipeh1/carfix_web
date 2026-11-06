// 本地存储驱动的图片回源路由：仅 STORAGE_DRIVER=local（或未配置 COS）时才会产生此类 URL
// 图片本身设计为公开可访问（文件名含随机串不可猜测），因此这里不做鉴权，与对象存储的公开读语义一致
import { NextRequest, NextResponse } from 'next/server'
import { mimeOf, readLocalImage } from '@/lib/storage'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params
  const joined = key.join('/')

  const buffer = await readLocalImage(joined)
  if (!buffer) return new NextResponse('Not Found', { status: 404 })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mimeOf(joined),
      // 文件名不可变（时间戳+随机串），可长期强缓存
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}
