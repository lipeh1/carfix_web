// 一键端到端验证：内嵌 Postgres → 迁移 → 生产构建 → 起服务 → 跑结算回归
// 用法：node scripts/e2e.mjs（结束后自动停库停服务）
import { spawn, execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 8890
const BASE_URL = `http://127.0.0.1:${PORT}`
const DATABASE_URL = 'postgresql://postgres:carweb-dev@127.0.0.1:5433/carweb'

const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: webDir, stdio: 'inherit', env: { ...process.env, DATABASE_URL }, ...opts })

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 端口探活（与 pg.mjs 同逻辑）
async function pgUp() {
  try {
    await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1500) }).catch(() => {})
  } catch { /* ignore */ }
  try {
    const net = await import('node:net')
    return await new Promise(resolve => {
      const s = net.connect(5433, '127.0.0.1')
      s.on('connect', () => { s.destroy(); resolve(true) })
      s.on('error', () => resolve(false))
      setTimeout(() => { s.destroy(); resolve(false) }, 1500)
    })
  } catch {
    return false
  }
}

let children = []
function cleanup() {
  for (const child of children) {
    try { child.kill() } catch { /* 已退出 */ }
  }
  try { execSync('node scripts/pg.mjs stop', { cwd: webDir, stdio: 'ignore' }) } catch { /* 尽力而为 */ }
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit())

async function main() {
  console.log('== 1/5 启动内嵌 Postgres ==')
  if (!(await pgUp())) {
    // 分离守护进程方式拉起（保持 postgres 的 stdio 不断裂）
    const keeper = spawn(process.execPath, ['scripts/pg.mjs', 'start'], {
      cwd: webDir, detached: true, stdio: 'ignore', shell: false
    })
    keeper.unref()
    let ok = false
    for (let i = 0; i < 90; i++) {
      await sleep(1000)
      if (await pgUp()) { ok = true; break }
    }
    if (!ok) throw new Error('内嵌 Postgres 未能在 90 秒内就绪')
  }
  console.log('[pg] 就绪')

  console.log('== 2/5 应用数据库迁移 ==')
  run('npx prisma migrate deploy')

  console.log('== 3/5 生产构建（含 SW） ==')
  if (!process.env.SKIP_BUILD) run('npm run build')

  console.log('== 4/5 启动生产服务 ==')
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL },
    stdio: 'inherit',
    shell: true
  })
  children.push(server)

  // 等待健康检查通过
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) { ready = true; break }
    } catch { /* 尚未就绪 */ }
    await sleep(1000)
  }
  if (!ready) throw new Error('服务未能在 60 秒内就绪')
  console.log(`服务已就绪：${BASE_URL}`)

  console.log('== 5/5 结算流程回归 ==')
  execSync(`node scripts/settlement-flow.mjs`, {
    cwd: webDir,
    stdio: 'inherit',
    env: { ...process.env, BASE_URL, DATABASE_URL }
  })
  console.log('\n端到端验证全部通过 ✓')
  process.exit(0)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
  process.exit(1)
})
