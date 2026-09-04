// 表单草稿：localStorage 轻量兜底，页面闪退/误退重进不丢已填内容
// 仅适用于纯文本字段；照片等即时上传的资源不在草稿范围

const PREFIX = 'carweb:draft:'

// 保存草稿（覆盖式）
export function saveDraft(key: string, data: Record<string, unknown>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data }))
  } catch { /* 隐私模式/容量满时静默 */ }
}

// 读取草稿数据，无草稿返回 null
export function loadDraft<T extends Record<string, unknown>>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (parsed?.data ?? null) as T | null
  } catch {
    return null
  }
}

// 清除草稿（提交流程完成后调用）
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* 忽略 */ }
}

// 草稿是否有实质内容（全空字符串/空数组的草稿视为无）
export function draftHasContent(d: Record<string, unknown> | null): boolean {
  if (!d) return false
  return Object.values(d).some(v => {
    if (Array.isArray(v)) return v.length > 0
    return typeof v === 'string' ? v.trim() !== '' : v != null
  })
}
