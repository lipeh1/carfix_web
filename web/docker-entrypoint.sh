#!/bin/sh
# 容器启动入口：先执行数据库迁移，再拉起 Next.js
# 说明：云托管没有 Vercel 那样的构建钩子能连到 VPC 内的数据库，
# 因此把 migrate deploy 放到启动阶段；迁移是幂等的，无变更时秒级返回
set -e

PRISMA_CLI="/app/prisma-cli/node_modules/prisma/build/index.js"
SCHEMA="/app/prisma/mysql/schema.prisma"

echo "[entrypoint] 执行数据库迁移（prisma migrate deploy）..."
node "$PRISMA_CLI" migrate deploy --schema "$SCHEMA"

# 紧急找回通道：忘记访问密码时，在云托管环境变量里加 RESET_PASSWORD=1 并发一次版，
# 启动时清空密码哈希与失败计数，站点重新进入「设置密码」流程；完成后务必删掉该变量
if [ -n "$RESET_PASSWORD" ]; then
  echo "[entrypoint] 检测到 RESET_PASSWORD，清空访问密码与登录失败计数..."
  # key 是 MySQL 保留字，必须用反引号包裹，否则语法错误会让 set -e 直接终止容器
  echo "DELETE FROM settings WHERE \`key\` = 'auth:password' OR \`key\` LIKE 'auth:fail:%';" \
    | node "$PRISMA_CLI" db execute --stdin --schema "$SCHEMA"
  echo "[entrypoint] 密码已清空，请重新访问站点设置密码，并删除 RESET_PASSWORD 变量"
fi

echo "[entrypoint] 启动 Next.js standalone 服务..."
exec node server.js
