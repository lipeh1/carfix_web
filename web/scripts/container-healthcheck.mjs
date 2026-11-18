// 容器探活同时检查登录页和真实数据库查询，避免只返回固定 200 却无法处理工单
try {
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`
  const [page, status] = await Promise.all([
    fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) }),
    fetch(`${base}/api/auth/status`, { signal: AbortSignal.timeout(3000) })
  ])
  if (!page.ok || !status.ok || typeof (await status.json()).initialized !== 'boolean') {
    process.exitCode = 1
  }
} catch {
  process.exitCode = 1
}
