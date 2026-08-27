# AGENTS.md - 项目开发规范

> 本文档用于约束 AI Agent 和开发者在本项目中的行为，确保代码风格一致、可维护。

## 项目概述

汽修管理系统 - 单用户移动端 Web 全栈应用，面向汽修门店的接车、维修、结算、交车全流程管理。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | Vue 3 + TypeScript | Composition API + `<script setup>` |
| 构建工具 | Vite | 开发服务器 & 构建 |
| UI 组件库 | Vant 4 | 移动端组件库，按需自动导入 |
| 路由 | Vue Router 4 | 历史模式 |
| HTTP 客户端 | Axios | 统一封装在 `src/api/` |
| 后端框架 | Express + TypeScript | RESTful API |
| ORM | Prisma 5 | SQLite 数据库，schema 即文档 |
| 数据库 | SQLite | 单文件数据库，文件位于 `server/prisma/dev.db` |
| 文件上传 | Multer | 图片存储在 `uploads/` 目录 |
| 运行时 | Node.js | tsx 开发热重载 |

## 项目结构

```
carweb/
├── client/                  # 前端项目
│   ├── src/
│   │   ├── api/             # API 接口封装（request.ts 基础封装 + index.ts 业务接口）
│   │   ├── layouts/         # 布局组件（TabBarLayout 底部导航）
│   │   ├── router/          # 路由配置
│   │   ├── styles/          # 全局样式
│   │   ├── views/           # 页面组件
│   │   ├── components/      # 公共组件
│   │   ├── utils/           # 工具函数
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts       # 已配置 /api、/uploads 代理到后端
│   └── package.json
├── server/                  # 后端项目
│   ├── src/
│   │   ├── routes/          # 路由模块（按业务域拆分）
│   │   ├── middleware/      # 中间件（错误处理等）
│   │   ├── prisma.ts        # Prisma 客户端单例
│   │   └── index.ts         # 应用入口
│   ├── prisma/
│   │   ├── schema.prisma    # 数据库模型定义（12张表）
│   │   └── dev.db           # SQLite 数据库文件
│   ├── .env                 # 环境变量
│   └── package.json
├── uploads/                 # 图片上传目录（git 忽略内容，保留 .gitkeep）
├── DESIGN.md                # 功能拆分与数据库设计文档
├── AGENTS.md                # 本文档
└── package.json             # 根 workspace 配置（concurrently 同时启动前后端）
```

## 开发规范

### 1. 注释规范（强制）

- **所有代码注释必须使用中文**，包括行内注释、函数说明、复杂逻辑说明。
- 禁止使用英文注释（代码本身的标识符、API 名称除外）。
- 每个业务模块文件顶部应有中文说明该模块的职责。
- 复杂逻辑、非显而易见的代码必须加中文注释说明原因。
- 示例：
  ```ts
  // 计算工单最终结算金额 = 报价项目 + 已确认增项 - 优惠
  const finalAmount = quoteTotal + additionalTotal - discount
  ```

### 2. 前端规范

- 使用 `<script setup lang="ts">` 语法。
- 组件名使用 PascalCase，文件名使用 PascalCase。
- API 调用统一通过 `src/api/index.ts` 中导出的函数，禁止在组件中直接使用 axios。
- 页面级组件放在 `views/`，可复用组件放在 `components/`。
- 样式优先使用 Vant 组件，自定义样式写在 `<style scoped>` 中。
- 金额统一使用 `Number()` 转换后保留两位小数显示。

### 3. 后端规范

- 路由按业务域拆分到 `src/routes/` 下，每个文件对应一个资源。
- 所有路由处理函数使用 `asyncHandler` 包装，统一错误处理。
- 业务错误抛出 `AppError`，指定状态码和消息。
- 数据库操作通过 Prisma Client，禁止手写 SQL。
- 时间字段使用 Prisma 的 `DateTime` 类型，前端展示用 dayjs 格式化。
- 金额字段使用 `Float` 类型，计算时注意精度。

### 4. 数据库规范

- 表名使用小写蛇形命名（如 `work_orders`），在 Prisma schema 中通过 `@@map` 指定。
- 字段名使用驼峰命名，通过 `@map` 映射到蛇形列名。
- 每张表必须有 `id` 主键（自增）、`created_at`、`updated_at`（如适用）。
- 外键关系必须在 Prisma schema 中显式定义 `@relation`。
- 迁移通过 `prisma migrate dev` 生成，禁止手动修改数据库。

### 5. Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>
```

**type 类型：**

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（既不新增功能也不修 bug） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |
| `init` | 项目初始化 |

**示例：**
```
feat(orders): 新增工单状态流转接口
fix(checkin): 修复接车照片上传路径错误
docs: 更新设计文档新增结算模块说明
chore: 升级 prisma 到 5.18.0
```

- subject 使用中文，简洁明了，不超过 50 字。
- scope 可选，指定影响的模块（如 `orders`、`checkin`、`client`、`server`）。
-  body 可选，详细说明变更内容和原因。

### 6. UI 设计规范（Linear 深色风格）

> 参考来源：awesome-design-md 项目 Linear 风格文档，按本项目「移动端 + Vant 4 + 业务工具」场景裁剪。
> 所有新增页面、组件必须遵循本节规范。

**总体原则**

- 深色画布即留白：层级靠「表面阶梯 + 1px 发丝线边框」表达，禁止用投影（box-shadow）做层级。
- 单一彩色强调：薰衣草蓝 `#5e6ad2` 只用于主按钮、焦点环、链接强调，禁止作为大面积背景或装饰色。
- 界面克制、信息密度高：不加渐变背景、聚光卡片等氛围装饰。
- 金额、工单号等数字内容使用等宽字体展示，便于对齐阅读。

**色彩令牌**

| 用途 | 色值 | 说明 |
|------|------|------|
| 画布（页面背景） | `#010102` | 近纯黑带微蓝，禁止用纯黑 `#000000` |
| 表面 1（卡片/面板） | `#0f1011` | 默认卡片背景 |
| 表面 2（选中/悬浮） | `#141516` | 选中项、强调卡片 |
| 表面 3（下拉/浮层） | `#18191a` | 弹出菜单、浮层 |
| 发丝线（边框/分割线） | `#23252a` | 1px；强调线用 `#34343a` |
| 主文字 | `#f7f8f8` | 标题与正文 |
| 次要文字 | `#d0d6e0` | 说明、元信息 |
| 辅助文字 | `#8a8f98` | 占位、标签 |
| 禁用文字 | `#62666d` | 不可用状态 |
| 主色（薰衣草蓝） | `#5e6ad2` | hover `#828fff`，按下 `#5e69d1` |
| 状态色 | 成功 `#27a644` | 工单状态可用低饱和红/橙/黄/蓝，仅限小面积徽章 |

**字号（移动端）**

| 用途 | 规格 | 字距 |
|------|------|------|
| 页面大标题 | 20px / 600 | -0.4px |
| 卡片标题 | 16px / 500 | -0.2px |
| 正文 | 14px / 400 | 0 |
| 辅助说明 | 12px / 400 | 0 |
| 按钮文字 | 14px / 500 | 0 |
| 金额/编号（等宽） | 14px / 400 | 0 |

- 字体栈：`-apple-system, system-ui, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif`（Linear 自有字体不公开分发，系统字体即官方替代方案）。
- 等宽字体：`ui-monospace, 'SF Mono', Consolas, monospace`。

**间距与圆角**

- 间距基数 4px，常用档位：4 / 8 / 12 / 16 / 24 / 32。移动端卡片内边距统一 16px，重点卡片 24px。
- 圆角：按钮与输入框 8px；卡片 12px；大面板 16px；状态徽章用全圆角（pill）。

**组件规则**

- 卡片：`表面1` 背景 + 1px `发丝线` 边框 + 12px 圆角；选中态升到 `表面2`，不叠加阴影。
- 按钮：主按钮薰衣草蓝底白字 8px 圆角；次级按钮 `表面1` 底 + 发丝线边框；禁止胶囊形主按钮。
- 输入框：`表面1` 背景、8px 圆角；聚焦态用 50% 透明度的主色 2px 外描边。
- 状态徽章：`表面2` 底、辅助色文字、pill 圆角、内边距 2px 8px。
- 列表（工单列表等）：行与行之间用发丝线分割，不加投影。

**Vant 适配要点**

- 根组件使用 `<van-config-provider theme="dark">` 开启暗色主题。
- 通过覆盖 CSS 变量对齐本规范：`--van-primary-color: #5e6ad2`、`--van-background: #010102`、`--van-background-2: #0f1011`、`--van-text-color: #f7f8f8`、`--van-border-color: #23252a`。
- 优先使用 Vant 组件并以其 CSS 变量微调，不重写组件内部结构。

**禁止事项**

- 禁止浅色页面；禁止大面积彩色背景；禁止引入第二主题色；禁止渐变与聚光装饰；禁止纯黑 `#000000` 画布。

## 常用命令

```bash
# 安装依赖（根目录执行，会同时安装前后端）
npm install

# 同时启动前后端开发服务器
npm run dev

# 分别启动
npm run dev:client   # 前端 http://localhost:8850
npm run dev:server   # 后端 http://localhost:8851

# 构建
npm run build

# 数据库迁移
npm run db:migrate

# 打开 Prisma Studio（数据库可视化）
npm run db:studio

# 生产环境启动
npm start
```

## 注意事项

- 单用户系统，不做登录鉴权和角色权限。
- 图片存储在本地 `uploads/` 目录，数据库存相对路径（如 `/uploads/xxx.jpg`）。
- 前端通过 Vite 代理访问后端 API 和图片，生产环境由 Express 静态托管前端构建产物。
- SQLite 数据库文件 `server/prisma/dev.db` 不提交到 git。
