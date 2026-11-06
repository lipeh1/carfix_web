// 图片存储抽象层：屏蔽具体存储厂商，上层只关心「上传得到可公开访问的 URL」与「按 URL 删除」
// 支持两种驱动：
//   cos   —— 腾讯云对象存储（生产环境，云托管容器无持久化磁盘，必须外部存储）
//   local —— 本地磁盘（本地开发零配置；也可用于自建服务器挂载数据盘）
// 驱动选择规则：显式配置 STORAGE_DRIVER 优先，否则「配了 COS 桶就走 COS，没配就回落本地」
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import COS from 'cos-nodejs-sdk-v5'
import { AppError } from './errors'

export type StorageDriver = 'cos' | 'local'

/** 上传文件统一归档在 checkin/ 目录下，与历史 Vercel Blob 时期的路径保持一致 */
export const UPLOAD_PREFIX = 'checkin'

/** 允许的图片扩展名（与上传接口校验一致） */
const ALLOWED_EXT = /^(jpe?g|png|gif|webp)$/i

/** 扩展名 → Content-Type，写入对象存储时需显式指定，否则浏览器可能按二进制下载 */
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}

/** 本地驱动的 URL 前缀：由 /api/files/[...key] 路由读盘回源 */
export const LOCAL_URL_PREFIX = '/api/files/'

function resolveDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER as StorageDriver | undefined
  if (explicit === 'cos' || explicit === 'local') return explicit
  if (process.env.COS_BUCKET) return 'cos'
  // 生产环境禁止静默回落本地：云托管容器无持久化磁盘，重启/扩缩容后图片会丢失
  // 确需本地存储（如自建服务器挂载数据盘）时请显式设置 STORAGE_DRIVER=local
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('生产环境未配置对象存储（COS_BUCKET），如需本地存储请显式设置 STORAGE_DRIVER=local', 500)
  }
  return 'local'
}

/** 本地驱动的落盘根目录，可通过 UPLOAD_DIR 指向挂载盘 */
function localRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), '.uploads')
}

// ===== COS 客户端（懒初始化单例，避免每次请求重复建连） =====

let cosClient: COS | null = null

function getCos(): COS {
  if (cosClient) return cosClient
  const secretId = process.env.COS_SECRET_ID
  const secretKey = process.env.COS_SECRET_KEY
  const bucket = process.env.COS_BUCKET
  const region = process.env.COS_REGION
  if (!secretId || !secretKey || !bucket || !region) {
    throw new AppError('对象存储未配置（需 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION）', 500)
  }
  cosClient = new COS({ SecretId: secretId, SecretKey: secretKey })
  return cosClient
}

/** 对象对外访问的基地址：默认用 COS 源站域名，也可配置 CDN 加速域名覆盖 */
function cosPublicBase(): string {
  if (process.env.COS_PUBLIC_BASE) return process.env.COS_PUBLIC_BASE.replace(/\/+$/, '')
  return `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`
}

// ===== 通用工具 =====

/** 由原始文件名或 MIME 推断扩展名，非法时抛错 */
export function resolveExt(fileName: string, mime: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
  const ext = fromName.toLowerCase()
  if (ALLOWED_EXT.test(ext)) return ext
  // 文件名没带扩展名时按 MIME 兜底
  const fromMime = mime.split('/').pop()?.toLowerCase() || ''
  if (ALLOWED_EXT.test(fromMime)) return fromMime === 'jpeg' ? 'jpg' : fromMime
  throw new AppError('只支持 jpg/png/gif/webp 图片')
}

/** 生成存储键：checkin/<时间戳>-<随机串>.<扩展名>，随机后缀不可猜测 */
export function buildKey(ext: string): string {
  const random = crypto.randomBytes(5).toString('hex')
  return `${UPLOAD_PREFIX}/${Date.now()}-${random}.${ext}`
}

/**
 * 校验 URL 是否属于本系统可删除范围：
 * 只允许 checkin/ 目录下、命名格式合规的图片，阻断借删除接口越权删任意对象
 */
function keyFromUrl(url: string): string {
  let pathname: string
  if (url.startsWith(LOCAL_URL_PREFIX)) {
    pathname = decodeURIComponent(url.slice(LOCAL_URL_PREFIX.length - 1))
  } else {
    try {
      pathname = new URL(url).pathname
    } catch {
      throw new AppError('非法的文件地址')
    }
  }
  const key = pathname.replace(/^\/+/, '')
  if (!key.startsWith(`${UPLOAD_PREFIX}/`)) throw new AppError('非法的文件地址')
  if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(key.split('/').pop() ?? '')) {
    throw new AppError('非法的文件名')
  }
  return key
}

// ===== 对外能力 =====

/** 写入图片，返回可公开访问的 URL 与存储键 */
export async function putImage(buffer: Buffer, ext: string): Promise<{ url: string; key: string }> {
  const key = buildKey(ext)

  if (resolveDriver() === 'local') {
    const filePath = path.join(localRoot(), key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
    return { url: `${LOCAL_URL_PREFIX}${key}`, key }
  }

  const cos = getCos()
  await cos.putObject({
    Bucket: process.env.COS_BUCKET as string,
    Region: process.env.COS_REGION as string,
    Key: key,
    Body: buffer,
    ContentType: MIME_BY_EXT[ext] || 'application/octet-stream',
    // 对象级 ACL 兜底：即使桶策略被改成私有读，图片仍可被 <img> 直接加载
    ACL: 'public-read'
  })
  return { url: `${cosPublicBase()}/${key}`, key }
}

/** 按 URL 删除图片；对象不存在视为成功（删除是幂等操作） */
export async function removeImageByUrl(url: string): Promise<void> {
  const key = keyFromUrl(url)

  // 本地驱动的 URL 只可能是 /api/files/ 前缀，按磁盘删除即可
  if (url.startsWith(LOCAL_URL_PREFIX)) {
    await fs.unlink(path.join(localRoot(), key)).catch(() => {})
    return
  }

  const cos = getCos()
  await cos.deleteObject({
    Bucket: process.env.COS_BUCKET as string,
    Region: process.env.COS_REGION as string,
    Key: key
  })
}

/** 读取本地驱动的文件（供 /api/files 路由回源，COS 驱动不会走到这里） */
export async function readLocalImage(key: string): Promise<Buffer | null> {
  const safeKey = keyFromUrl(`${LOCAL_URL_PREFIX}${key}`)
  try {
    return await fs.readFile(path.join(localRoot(), safeKey))
  } catch {
    return null
  }
}

/** 本地驱动的 MIME 查询，供回源路由设置响应头 */
export function mimeOf(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}
