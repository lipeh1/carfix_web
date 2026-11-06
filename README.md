# 汽修管理系统 (carweb)

移动端 Web 全栈应用，单用户汽修门店管理系统。

## 技术栈

- **框架**: Next.js 16（App Router）+ React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui + motion（Linear 深色风格双主题）
- **数据库**: 生产用云开发 MySQL（腾讯云 CloudBase）/ 本地开发用内嵌 PostgreSQL + Prisma ORM
- **图片存储**: 腾讯云 COS（生产）/ 本地磁盘（开发），统一由 `web/src/lib/storage.ts` 抽象
- **PWA**: @serwist/next（添加到桌面、离线缓存）
- **部署**: 腾讯云 CloudBase 云托管（Docker + Next.js standalone）

## 项目结构

```
carweb/
├── web/                # Next.js 应用（页面 + API）
│   ├── prisma/         # Prisma schema 与迁移
│   ├── scripts/        # 内嵌 PG 启停 / 回归测试 / 一键 E2E
│   └── src/
│       ├── app/        # 页面与 Route Handlers
│       ├── components/ # shadcn 组件 + 手写移动组件
│       └── lib/        # prisma/auth/api 与工具函数
├── docs/               # 业务流程图与功能手册
├── DESIGN.md           # 功能与数据库设计文档
└── package.json        # 根编排脚本
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动本地数据库（无需 Docker，内嵌 PostgreSQL）

```bash
npm run dev:db
```

首次自动初始化（端口 5433，数据在 `web/.pgdata`）。然后配置环境变量：

```bash
cp web/.env.example web/.env.local
# 编辑 web/.env.local：
# DATABASE_URL=postgresql://postgres:carweb-dev@127.0.0.1:5433/carweb
```

### 3. 应用迁移并启动开发环境

```bash
npm run db:deploy
npm run dev            # http://localhost:3000，首次访问设置访问密码
```

### 4. 验证 / 构建

```bash
npm test               # 一键端到端：PG → 迁移 → 构建 → 服务 → 结算回归
npm run build && npm start
```

## 部署（腾讯云 CloudBase 云托管）

面向中国大陆公网访问，完整步骤见 **[docs/部署-腾讯云CloudBase.md](./docs/部署-腾讯云CloudBase.md)**。

一句话概览：

1. 云开发环境 → 开通云开发 MySQL（拿内网连接串）→ 开通 COS 桶（公有读私有写）
2. 云托管新建服务：代码目录 `web/`、端口 `3000`、开启私有网络选中 MySQL 所在 VPC
3. 配环境变量 `DATABASE_URL` / `COS_*`，部署即自动建表（容器启动跑 `prisma migrate deploy`）
4. 首次访问设置访问密码；**正式使用需绑定已备案的自定义域名**（默认域名会弹测试中间页）

> 历史 Vercel 部署（`*.vercel.app`）在大陆无法直连，已停止维护；`vercel-build` 脚本仅作留档。

## 功能模块

详见 [DESIGN.md](./DESIGN.md)
