// 单用户访问控制核心：密码 scrypt 哈希落库 + 会话 HMAC 签名 Cookie
// 不引入用户表/JWT 依赖,与"单用户工具"定位匹配
import crypto from 'crypto'
import prisma from './prisma'

// 会话有效期 30 天(与 Cookie maxAge 一致)
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000
export const SESSION_COOKIE = 'carweb_session'

// ===== 密码哈希：scrypt + 随机盐,杜绝明文/可逆存储 =====

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64)
  const target = Buffer.from(hash, 'hex')
  // 长度一致才可比较,恒定时间比较防时序侧信道
  return test.length === target.length && crypto.timingSafeEqual(test, target)
}

// ===== 设置项读写（密码哈希 / 会话密钥都存 settings 表） =====

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function getPasswordHash(): Promise<string | null> {
  return getSetting('auth:password')
}

export async function setPasswordHash(password: string): Promise<void> {
  const value = hashPassword(password)
  await prisma.setting.upsert({
    where: { key: 'auth:password' },
    update: { value },
    create: { key: 'auth:password', value }
  })
}

// 会话签名密钥:首次生成随机值落库,服务重启后旧会话仍可校验
export async function getSessionSecret(): Promise<string> {
  const existing = await getSetting('auth:secret')
  if (existing) return existing
  const secret = crypto.randomBytes(48).toString('hex')
  await prisma.setting.upsert({
    where: { key: 'auth:secret' },
    update: {},
    create: { key: 'auth:secret', value: secret }
  })
  return secret
}

// ===== 会话令牌：base64url(payload).HMAC,无状态可校验 =====

export function signSession(secret: string): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifySessionToken(secret: string, token?: string | null): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expect = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

// 轻量 cookie 解析（免 cookie-parser 依赖）
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}
