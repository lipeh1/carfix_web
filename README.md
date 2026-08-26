# 汽修管理系统 (carweb)

移动端 Web 全栈应用，单用户汽修门店管理系统。

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Vant + Vue Router
- **后端**: Node.js + Express + TypeScript
- **数据库**: SQLite + Prisma ORM
- **图片存储**: 本地文件系统

## 项目结构

```
carweb/
├── client/          # 前端 Vue3 移动端
│   ├── src/
│   │   ├── views/       # 页面组件
│   │   ├── layouts/     # 布局组件
│   │   ├── router/      # 路由配置
│   │   ├── api/         # API 接口封装
│   │   ├── utils/       # 工具函数
│   │   └── components/  # 公共组件
│   └── ...
├── server/          # 后端 Express API
│   ├── src/
│   │   ├── routes/      # 路由
│   │   └── middleware/  # 中间件
│   ├── prisma/          # Prisma schema 和迁移
│   └── ...
├── uploads/         # 图片上传目录
├── DESIGN.md        # 功能与数据库设计文档
└── package.json     # 根 workspace 配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run db:init
```

### 3. 启动开发环境

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 功能模块

详见 [DESIGN.md](./DESIGN.md)
