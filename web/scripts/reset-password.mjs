// 一次性访问密码重置：删除 settings 表中的密码哈希与登录失败计数
// 重置后 /api/auth/status 返回 initialized:false，站点重新进入「设置密码」流程
// 会话密钥 auth:secret 保留，已登录设备的旧会话不受影响
//
// 用法：
//   本地：DATABASE_URL=<连接串> node scripts/reset-password.mjs
//   云端：由 vercel-build.mjs 在设置了 RESET_PASSWORD 环境变量时自动调用
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (!process.env.DATABASE_URL) {
  console.error('缺少 DATABASE_URL 环境变量')
  process.exit(1)
}

// 直接执行原生 SQL，不依赖 Prisma Client 的生成状态
execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
  cwd: webDir,
  stdio: 'inherit',
  input: "DELETE FROM settings WHERE key = 'auth:password' OR key LIKE 'auth:fail:%';"
})

console.log('已清空访问密码与失败计数：下次打开站点将重新进入「设置密码」流程')
