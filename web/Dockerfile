# 汽修管理系统 —— 云托管镜像
# 目标平台：腾讯云 CloudBase 云托管（Linux amd64）
# 镜像结构：builder（装依赖 + 生成 MySQL Prisma Client + next build）→ runner（standalone 运行时）
#           migrator（独立装 prisma CLI，供容器启动时执行 migrate deploy）

ARG NODE_IMAGE=node:22-slim

# ===== 1. 迁移工具层：只装 Prisma CLI 与迁移引擎 =====
# 独立成层的原因：Prisma CLI 属于 devDependencies，standalone 产物里不含，
# 但容器启动时需要它执行 migrate deploy，单独安装比整包 node_modules 小得多
FROM ${NODE_IMAGE} AS migrator
WORKDIR /prisma-cli

# 国内构建建议走镜像源，避免拉引擎二进制超时（可在构建时覆盖）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

ENV PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true \
    NEXT_TELEMETRY_DISABLED=1

RUN npm init -y > /dev/null 2>&1 \
 && npm install prisma@5.22.0 --omit=dev --no-audit --no-fund --registry=${NPM_REGISTRY}

# ===== 2. 构建层 =====
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

# 构建阶段不需要真实数据库连接，给一个占位串即可让 prisma generate 通过
ENV NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
    DATABASE_URL=mysql://build:build@localhost:3306/build

# Prisma 查询引擎依赖 openssl，slim 镜像需显式安装
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 先只拷依赖清单，命中缓存层；prisma 目录必须一并拷入，
# 因为 package.json 的 postinstall 会执行 prisma generate，找不到 schema 会直接失败
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --registry=${NPM_REGISTRY}

COPY . .

# 由 PG 版 schema 派生 MySQL 版并生成对应 Client（代码层已去除 provider 专有写法）
RUN node scripts/gen-mysql-schema.mjs \
 && npx prisma generate --schema prisma/mysql/schema.prisma \
 && npm run build

# ===== 3. 运行层 =====
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# HOSTNAME 必须绑 0.0.0.0：standalone 默认监听 localhost，容器外访问不到
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物 + 静态资源（.next/static 与 public 不会被自动收进 standalone，必须单独拷）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma Client 引擎（standalone 追踪有时会漏，显式拷贝更稳）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# 迁移所需：schema + 迁移文件 + 独立 Prisma CLI
COPY --from=builder --chown=nextjs:nodejs /app/prisma/mysql ./prisma/mysql
COPY --from=migrator --chown=nextjs:nodejs /prisma-cli/node_modules ./prisma-cli/node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# 云托管要求健康检查能拿到 2xx/3xx；/login 为公开页，未登录也可访问
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
