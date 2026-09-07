// 访问控制中间件：校验会话 Cookie,未登录返回 401（由前端拦截器跳转登录页）
import { Request, Response, NextFunction } from 'express'
import { verifySessionToken, parseCookies, getSessionSecret, SESSION_COOKIE } from '../auth'
import { AppError } from './error'

// 密钥进程内缓存（落库只在首次生成,之后不变）
let cachedSecret: string | null = null

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!cachedSecret) cachedSecret = await getSessionSecret()
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!verifySessionToken(cachedSecret, token)) {
      throw new AppError('未登录或会话已过期', 401)
    }
    next()
  } catch (e) {
    next(e)
  }
}
