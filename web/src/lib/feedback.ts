// 触觉反馈：支持的设备上短震动一下（提交成功等关键节点）
export function hapticFeedback(): void {
  try {
    navigator.vibrate?.(40)
  } catch { /* 不支持的设备静默忽略 */ }
}
