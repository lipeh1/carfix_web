// 本地内嵌 PostgreSQL 生命周期管理（无需 Docker）
// 用法：node scripts/pg.mjs start|stop|check
// 数据落在 web/.pgdata（已 gitignore），端口 5433，幂等可重复执行。
// start 由 pg_ctl 守护化 Postgres 后即退出，进程本身不保活。
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(webDir, '.pgdata')
const PORT = 5433
const USER = 'postgres'
const PASSWORD = 'carweb-dev'
const DB = 'carweb'

export const DATABASE_URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`

// 端口探活：有监听即视为在运行
function isUp() {
  try {
    execSync(
      `node -e "const net=require('net');const s=net.connect(${PORT},'127.0.0.1');s.on('connect',()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)"`,
      { stdio: 'ignore', timeout: 5000 }
    )
    return true
  } catch {
    return false
  }
}

// 以分离守护进程方式拉起 PG 守护脚本（脚本内保活，避免 stdio 断裂连带 postgres 退出）
export function startDetached() {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'start'], {
    cwd: webDir,
    detached: true,
    stdio: 'ignore',
    shell: false
  })
  child.unref()
}

async function start() {
  if (isUp()) {
    console.log(`[pg] 端口 ${PORT} 已有实例在运行，跳过启动`)
    return
  }
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true
  })
  // 仅首次初始化集群；已有数据目录时直接启动（initdb 遇非空目录会失败）
  if (!existsSync(resolve(DATA_DIR, 'PG_VERSION'))) {
    await pg.initialise()
  }
  await pg.start()
  // 幂等建库：首次初始化时需要手动建业务库
  try {
    await pg.createDatabase(DB)
  } catch { /* 已存在 */ }
  console.log(`[pg] 已启动：${DATABASE_URL}`)
}

function stop() {
  if (!isUp()) {
    console.log('[pg] 未在运行')
    return
  }
  // 用 pg_ctl 优雅停库（embedded-postgres 未暴露 stop API）
  const bin = resolve(webDir, 'node_modules/@embedded-postgres/windows-x64/bin/pg_ctl.exe')
  execSync(`"${bin}" -D "${DATA_DIR}" stop -m fast`, { stdio: 'inherit' })
  console.log('[pg] 已停止')
}

const cmd = process.argv[2]
if (cmd === 'start') {
  await start()
  // 保活：postgres 继承了本进程的 stdio 管道，本进程退出会连带其终止，
  // 因此 start 以独立守护进程方式常驻（由调用方 startDetached 拉起）
  setInterval(() => {}, 1000)
} else if (cmd === 'stop') {
  stop()
} else if (cmd === 'check') {
  console.log(isUp() ? 'up' : 'down')
} else if (cmd === 'start-detached') {
  startDetached()
  console.log('[pg] 守护进程已拉起')
} else {
  console.log('用法: node scripts/pg.mjs start|start-detached|stop|check')
}
