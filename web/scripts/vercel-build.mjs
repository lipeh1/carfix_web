// Vercel 构建入口（仅云端执行，本地构建仍走 npm run build）：
// 1. 用直连地址（UNPOOLED）执行 prisma migrate deploy —— 池化连接走 PgBouncer 事务模式，
//    与 Prisma 迁移的 advisory lock / 预编译语句不兼容，必须绕开
// 2. 生成 Prisma Client
// 3. 生产构建（serwist 需要 webpack 管线）
import { execSync } from 'node:child_process'

// 云端未提供直连变量时（如本地手动调用）回落到 DATABASE_URL
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED
}

const run = cmd => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

run('npx prisma migrate deploy')
run('npx prisma generate')
run('npx next build --webpack')
