// 前端请求封装：与旧 axios 封装语义一致
// - 返回接口 JSON 数据
// - 401 静默跳登录页（登录接口自身除外，由登录页提示）
// - skipToast 标记的请求不弹错误提示（如登录页的会话探测）
import { toast } from 'sonner'

export interface RequestOptions {
  /** 查询参数 */
  params?: Record<string, string | number | undefined>
  /** 请求体（自动 JSON 序列化） */
  body?: unknown
  /** 标记后请求失败不弹全局 toast */
  skipToast?: boolean
  /** 超时毫秒数，默认 15000 */
  timeout?: number
}

// 参数对象转为查询串（跳过 undefined）
function qs(params?: RequestOptions['params']): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (!entries.length) return ''
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

// 未指定泛型时的返回类型：宽松 JSON 结构（调用方按需断言或用 api.ts 的具体泛型）
type Json = Record<string, unknown>

export async function request<T = Json>(
  method: string,
  url: string,
  opts: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 15000)
  try {
    const res = await fetch(`/api${url}${qs(opts.params)}`, {
      method,
      signal: controller.signal,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    })

    let data: Json | null = null
    try {
      data = await res.json()
    } catch { /* 非 JSON 响应体忽略 */ }

    if (!res.ok) {
      // 消息取自后端 { message } 结构；非字符串时兜底通用文案
      const fallback = res.status === 401 ? '未登录或会话已过期' : '请求失败'
      const message = typeof data?.message === 'string' ? data.message : fallback
      // 会话失效：静默跳转登录页（登录页自身的 401 由页面提示）
      if (res.status === 401 && window.location.pathname !== '/login') {
        window.location.replace('/login')
        throw new Error(message)
      }
      if (!opts.skipToast) toast(message) // 纯文字 toast，错误语义由文案表达
      throw new Error(message)
    }
    return data as T
  } catch (e) {
    // AbortError：超时中断（e 为 unknown，按 name 探测）
    if ((e as Error)?.name === 'AbortError') {
      if (!opts.skipToast) toast('请求超时，请重试')
      throw new Error('请求超时')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const http = {
  get: <T = Json>(url: string, opts?: RequestOptions) => request<T>('GET', url, opts),
  post: <T = Json>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', url, { ...opts, body }),
  put: <T = Json>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', url, { ...opts, body }),
  patch: <T = Json>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', url, { ...opts, body }),
  delete: <T = Json>(url: string, opts?: RequestOptions) => request<T>('DELETE', url, opts)
}
