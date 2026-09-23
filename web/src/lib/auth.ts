// 单用户访问控制核心：密码 scrypt 哈希落库 + 会话 HMAC 签名 Cookie
// 不引入用户表/JWT 依赖，与「单用户工具」定位匹配（自 Express 版原样移植）
import crypto from 'crypto'
import prisma from './prisma'

// 会话有效期 30 天（与 Cookie maxAge 一致）
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000
export const SESSION_COOKIE = 'carweb_session'

// ===== 密码哈希：scrypt + 随机盐，杜绝明文/可逆存储 =====

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
  // 长度一致才可比较，恒定时间比较防时序侧信道
  return test.length === target.length && crypto.timingSafeEqual(test, target)
}

// ===== 设置项读写（密码哈希 / 会话密钥 / 登录防爆破计数都存 settings 表） =====

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

// ===== 找回密码恢复码：仅生成时显示一次，哈希落库，使用一次即作废 =====

// 32 字符表去掉易混淆的 0/O/1/I，随机 8 位（约 2^40 空间，配合失败锁定防爆破）
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function genRecoveryCode(): string {
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += RECOVERY_ALPHABET[bytes[i] % 32]
  return code
}

export async function getRecoveryHash(): Promise<string | null> {
  return getSetting('auth:recovery')
}

export async function setRecoveryHash(code: string): Promise<void> {
  const value = hashPassword(code)
  await prisma.setting.upsert({
    where: { key: 'auth:recovery' },
    update: { value },
    create: { key: 'auth:recovery', value }
  })
}

// 会话签名密钥：首次生成随机值落库，实例冷启动后旧会话仍可校验
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

// ===== 会话令牌：base64url(payload).HMAC，无状态可校验 =====

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

// 轻量 cookie 解析（免 cookie 依赖）
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

// ===== 验证失败防爆破：同 IP 连续失败 5 次锁定 60 秒 =====
// 原为进程内存 Map，Serverless 多实例下失效，改为 settings 表 KV 存储
// （Serverless 下 x-forwarded-for 不可伪造，key 直接按 IP 隔离）
// prefix 区分用途：登录计数 auth:fail / 恢复码计数 auth:rfail，互不影响

const FAIL_THRESHOLD = 5
const LOCK_MS = 60_000

interface FailState {
  count: number
  until: number
}

const failKey = (prefix: string, ip: string) => `${prefix}:${ip}`

// 读取失败计数（损坏的值视为无记录，不影响验证）
async function getFailState(prefix: string, ip: string): Promise<FailState> {
  try {
    const raw = await getSetting(failKey(prefix, ip))
    if (!raw) return { count: 0, until: 0 }
    const parsed = JSON.parse(raw) as FailState
    if (typeof parsed.count !== 'number' || typeof parsed.until !== 'number') return { count: 0, until: 0 }
    return parsed
  } catch {
    return { count: 0, until: 0 }
  }
}

// 是否处于锁定窗口（锁定期间直接拒绝，不再校验）
async function isLocked(prefix: string, ip: string): Promise<boolean> {
  const state = await getFailState(prefix, ip)
  return state.until > Date.now()
}

// 记录一次失败：达到阈值进入锁定窗口并清零计数，否则累加
async function recordFail(prefix: string, ip: string): Promise<void> {
  const state = await getFailState(prefix, ip)
  const count = state.count + 1
  const next: FailState = count >= FAIL_THRESHOLD
    ? { count: 0, until: Date.now() + LOCK_MS }
    : { count, until: 0 }
  await prisma.setting.upsert({
    where: { key: failKey(prefix, ip) },
    update: { value: JSON.stringify(next) },
    create: { key: failKey(prefix, ip), value: JSON.stringify(next) }
  })
}

// 清除失败计数（验证成功后调用）
async function clearFails(prefix: string, ip: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: failKey(prefix, ip) } })
}

export const isLoginLocked = (ip: string) => isLocked('auth:fail', ip)
export const recordLoginFail = (ip: string) => recordFail('auth:fail', ip)
export const clearLoginFails = (ip: string) => clearFails('auth:fail', ip)

// 恢复码验证计数与登录计数隔离：恢复码输错不消耗登录尝试次数
export const isRecoverLocked = (ip: string) => isLocked('auth:rfail', ip)
export const recordRecoverFail = (ip: string) => recordFail('auth:rfail', ip)
export const clearRecoverFails = (ip: string) => clearFails('auth:rfail', ip)
