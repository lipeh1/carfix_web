// 关键操作触觉反馈：安卓 Chrome/微信有效，iOS Safari 不支持 vibrate 时静默忽略
export const hapticFeedback = (pattern: number | number[] = 50) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch { /* 部分环境调用抛错，忽略 */ }
}
