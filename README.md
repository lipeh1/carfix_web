# 汽修管理系统 (carweb)

移动端 Web 全栈应用，单用户汽修门店管理系统。

## 技术栈

- **框架**: Next.js 16（App Router）+ React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui + motion（Linear 深色风格双主题）
- **数据库**: PostgreSQL（Vercel Postgres / Neon）+ Prisma ORM
- **图片存储**: Vercel Blob（客户端直传，公开随机 URL）
- **PWA**: @serwist/next（添加到桌面、离线缓存）
- **部署**: Vercel

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

## 部署（Vercel）

线上地址：**https://carweb-lipeh1s-projects.vercel.app**（备用 https://carweb-dusky.vercel.app；大陆直连 `*.vercel.app` 不通，需代理或绑定自定义域名）。

1. 已通过 Git 集成自动部署：push 到 `master` 即自动构建上线（项目 Root Directory = `web/`，生产分支 `master`）。
2. 存储由 Vercel 集成注入：Postgres（Neon）的 `DATABASE_URL` 与 Blob 直传凭证；构建时 `vercel-build` 自动执行 `prisma migrate deploy` 建表，无需手工迁移。
3. 可选：配置 `BAIDU_OCR_API_KEY` / `BAIDU_OCR_SECRET_KEY` 启用行驶证/车牌识别。
4. 打开站点设置访问密码即可使用；手机浏览器「添加到主屏幕」获得独立应用形态。

## 功能模块

详见 [DESIGN.md](./DESIGN.md)
