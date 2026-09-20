// Route Handler 层通用助手：鉴权包装、统一错误响应、会话 Cookie 下发
// 对应 Express 版的全局 requireAuth 中间件 + errorHandler
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from './errors'
import { verifySessionToken, parseCookies, getSessionSecret, SESSION_COOKIE, SESSION_TTL_MS, signSession } from './auth'

// Next 15+ 动态路由参数为 Promise，需 await 取值
type RouteContext<P> = { params: Promise<P> }

// 校验会话 Cookie，无效抛 401（前端请求封装统一跳转登录页）
export async function requireAuth(req: NextRequest): Promise<void> {
  const secret = await getSessionSecret()
  const token = parseCookies(req.headers.get('cookie') ?? undefined)[SESSION_COOKIE]
  if (!verifySessionToken(secret, token)) {
    throw new AppError('未登录或会话已过期', 401)
  }
}

// 业务路由统一包装：先鉴权再执行，AppError 用其状态码，其余 500
export function withAuth<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    try {
      await requireAuth(req)
      return await handler(req, ctx)
    } catch (e) {
      return errorResponse(e)
    }
  }
}

// 公开路由（/api/auth 系列）包装：只做统一错误映射，不鉴权
export function withRoute<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      return errorResponse(e)
    }
  }
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ message: e.message }, { status: e.statusCode })
  }
  const err = e as Error
  console.error('[Error]', err?.message)
  return NextResponse.json({ message: err?.message || '服务器内部错误' }, { status: 500 })
}

// 登录成功后下发会话 Cookie：
// httpOnly 防 JS 读取，sameSite=lax 防跨站提交，HTTPS 下自动加 secure
export function sessionCookieOptions(req: NextRequest) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000, // Next cookie maxAge 单位为秒（Express 为毫秒，移植时注意换算）
    secure: req.headers.get('x-forwarded-proto') === 'https'
  }
}

// 在响应上附加会话 Cookie（签名密钥落库，多实例下一致）
export async function attachSession(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  const secret = await getSessionSecret()
  res.cookies.set(SESSION_COOKIE, signSession(secret), sessionCookieOptions(req))
  return res
}

// 客户端 IP：Vercel/反代场景取 x-forwarded-for 首段
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}
