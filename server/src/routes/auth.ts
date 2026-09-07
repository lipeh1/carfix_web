// 访问控制路由：首次设置密码 / 登录 / 登出 / 修改密码 / 会话检查
import { Router, Request, Response } from 'express'
import { AppError, asyncHandler } from '../middleware/error'
import { requireAuth } from '../middleware/auth'
import {
  getPasswordHash, setPasswordHash, verifyPassword,
  getSessionSecret, signSession, SESSION_COOKIE, SESSION_TTL_MS
} from '../auth'

const router = Router()

// 登录成功后下发会话 Cookie:
// httpOnly 防 JS 读取,sameSite=lax 防跨站提交,HTTPS 下自动加 secure
const attachSession = (req: Request, res: Response) => {
  return getSessionSecret().then((secret) => {
    res.cookie(SESSION_COOKIE, signSession(secret), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
    })
  })
}

// 登录防爆破：同 IP 连续失败 5 次锁定 60 秒（内存计数,重启即清）
const failMap = new Map<string, { count: number; until: number }>()

// 初始化状态（是否已设置密码）,登录页据此展示"设置/登录"两种形态
router.get('/status', asyncHandler(async (_req, res) => {
  const hash = await getPasswordHash()
  res.json({ initialized: !!hash })
}))

// 首次设置访问密码（仅允许一次）
router.post('/setup', asyncHandler(async (req, res) => {
  if (await getPasswordHash()) throw new AppError('访问密码已初始化,请直接登录', 403)
  const { password } = req.body
  if (!password || String(password).length < 6) throw new AppError('密码至少 6 位')
  await setPasswordHash(String(password))
  await attachSession(req, res)
  res.json({ success: true })
}))

// 登录
router.post('/login', asyncHandler(async (req, res) => {
  const ip = req.ip || 'unknown'
  const state = failMap.get(ip)
  if (state && state.until > Date.now()) {
    throw new AppError('尝试过于频繁,请 1 分钟后再试', 429)
  }
  const { password } = req.body
  const hash = await getPasswordHash()
  if (!hash || !password || !verifyPassword(String(password), hash)) {
    const fails = (state?.count || 0) + 1
    failMap.set(ip, fails >= 5
      ? { count: 0, until: Date.now() + 60_000 }
      : { count: fails, until: 0 })
    throw new AppError('密码不正确', 401)
  }
  failMap.delete(ip)
  await attachSession(req, res)
  res.json({ success: true })
}))

// 登出:清空会话 Cookie（未登录调用也无害）
router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ success: true })
})

// 会话检查：已登录 200,未登录 401（前端登录页用于判断能否直接进入）
router.get('/me', requireAuth, (_req, res) => {
  res.json({ authed: true })
})

// 修改密码（需已登录）
router.post('/password', requireAuth, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const hash = await getPasswordHash()
  if (!hash || !verifyPassword(String(oldPassword || ''), hash)) {
    throw new AppError('原密码不正确')
  }
  if (!newPassword || String(newPassword).length < 6) throw new AppError('新密码至少 6 位')
  await setPasswordHash(String(newPassword))
  await attachSession(req, res)
  res.json({ success: true })
}))

export default router
