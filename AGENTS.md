# AGENTS.md - 项目开发规范

> 本文档用于约束 AI Agent 和开发者在本项目中的行为，确保代码风格一致、可维护。

## 项目概述

汽修管理系统 - 单用户移动端 Web 全栈应用，面向汽修门店的接车、维修、结算、交车全流程管理。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript | 全栈一体：页面 + API Route Handlers |
| 样式 | Tailwind CSS v4 + shadcn/ui（radix） | 设计令牌见 global.css，组件在 `components/ui` |
| 动效 | motion（motion/react） | 弹簧动画，`useAnimatedYuan` 数字滚动 |
| ORM | Prisma 5 | schema 即文档 |
| 数据库 | PostgreSQL（Vercel Postgres / Neon） | 连接串在 `DATABASE_URL` |
| 文件存储 | Vercel Blob | 接车照片客户端直传，公开随机 URL |
| PWA | @serwist/next | manifest + Service Worker 离线缓存 |
| 部署 | Vercel | Root Directory = `web` |

## 项目结构

```
carweb/
├── web/                        # 应用全部代码（Next.js）
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库模型定义（13 张表）
│   │   └── migrations/         # 迁移文件（provider: postgresql）
│   ├── public/
│   │   └── icons/              # PWA 图标
│   ├── scripts/
│   │   ├── pg.mjs              # 本地内嵌 PostgreSQL 启停（无需 Docker）
│   │   ├── settlement-flow.mjs # 结算流程回归测试（真实 HTTP + 鉴权）
│   │   └── e2e.mjs             # 一键端到端：PG → 迁移 → 构建 → 服务 → 回归
│   └── src/
│       ├── app/
│       │   ├── (tabs)/         # 底部标签栏布局：/ 工作台、orders、customers、reminders
│       │   ├── checkin/        # 接车登记
│       │   ├── orders/[id]/    # 工单详情 + quote/ 检测报价
│       │   ├── customers/[id]/ # 客户详情
│       │   ├── vehicles/[id]/  # 车辆详情
│       │   ├── stats/          # 统计报表
│       │   ├── login/          # 访问密码页
│       │   └── api/**/route.ts # 全部业务 API
│       ├── components/
│       │   ├── ui/             # shadcn 组件
│       │   ├── mobile/         # 手写移动组件（TabBar/NavBar/BottomSheet/Cell/PullToRefresh/InfiniteScroll/ImagePreview/ScrollTabs/Badge/Field/Empty/ConfirmProvider）
│       │   └── PlateKeyboard.tsx / PageSkeleton.tsx / InstallGuide.tsx
│       └── lib/
│           ├── prisma.ts       # Prisma 单例（globalThis 缓存）
│           ├── auth.ts         # scrypt 密码哈希 + HMAC Cookie 会话 + 防爆破锁（settings KV）
│           ├── api-helpers.ts  # withAuth/withRoute 包装器、错误映射、会话下发
│           ├── api.ts          # 全部业务接口函数；api-client.ts 为 fetch 封装
│           └── money/plate/draft/image/feedback/quoteCard/format/hooks
├── docs/                       # 业务流程图与功能手册
├── DESIGN.md                   # 功能拆分与数据库设计文档
├── AGENTS.md                   # 本文档
└── package.json                # 根编排脚本
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

- 页面组件全部为客户端组件（`'use client'`），交互形态与数据获取沿用「进页面拉取」模式。
- 组件名使用 PascalCase，文件名使用 PascalCase。
- API 调用统一通过 `src/lib/api.ts` 中导出的函数，禁止在组件中直接 fetch。
- 页面级组件放在 `src/app/` 对应路由目录，可复用组件放在 `src/components/`。
- 样式优先使用设计令牌 CSS 变量（`var(--surface-1)` 等）与既有全局类（`.card`、`.material-bar`、`.pressable`、`.page-frame`），其次 Tailwind 布局工具类；禁止绕过令牌硬编码颜色。
- 动效用 `motion/react`：进场弹簧 `{ type: 'spring', bounce: 0, duration: 0.35 }`，按压 `whileTap`。
- 金额一律走 `lib/money.ts`（分↔元），展示两位小数；数字内容用 `font-mono` 等宽展示。

### 3. 后端规范（Route Handlers）

- 每个 REST 资源一个 `route.ts`，动态段参数为 Promise：`const { id } = await params`。
- 业务路由统一用 `withAuth`（先鉴权后执行），公开路由用 `withRoute`，二者都做 AppError → 状态码映射。
- 业务错误抛 `AppError`，指定状态码和消息；禁止裸 `Response.json` 错误。
- 数据库操作通过 `lib/prisma.ts` 单例；多步写入必须 `$transaction`。
- 时间字段使用 Prisma 的 `DateTime` 类型，前端展示用 dayjs 格式化（`lib/format.ts`）。
- 金额字段一律整数「分」，服务端不重复换算。

### 4. 数据库规范

- 表名使用小写蛇形命名（如 `work_orders`），在 Prisma schema 中通过 `@@map` 指定。
- 字段名使用驼峰命名，通过 `@map` 映射到蛇形列名。
- 每张表必须有 `id` 主键（自增）、`created_at`、`updated_at`（如适用）。
- 外键关系必须在 Prisma schema 中显式定义 `@relation`。
- 迁移通过 `prisma migrate dev` 生成，禁止手动修改数据库；部署用 `prisma migrate deploy`。
- PostgreSQL 下文本模糊搜索（`contains`）需带 `mode: 'insensitive'` 保持大小写不敏感。

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
fix(checkin): 修复接车照片上传失败无提示的问题
docs: 更新设计文档新增结算模块说明
chore: 升级 prisma 到 5.18.0
```

- subject 使用中文，简洁明了，不超过 50 字。
- scope 可选，指定影响的模块（如 `orders`、`checkin`、`web`）。
- body 可选，详细说明变更内容和原因。

### 6. UI 设计规范（Linear 深色风格）

> 所有新增页面、组件必须遵循本节规范。令牌定义见 `web/src/app/globals.css`。

**总体原则**

- 双主题跟随系统：深色为默认，浅色通过 `prefers-color-scheme: light` 自动切换；**禁止绕过设计令牌硬编码颜色**，否则另一主题下必然出问题。
- 深色画布即留白：层级靠「表面阶梯 + 1px 发丝线边框」表达，禁止用投影（box-shadow）做层级。
- 单一彩色强调：薰衣草蓝 `#5e6ad2` 只用于主按钮、焦点环、链接强调，禁止作为大面积背景或装饰色。
- 界面克制、信息密度高：不加渐变背景、聚光卡片等氛围装饰。
- 金额、工单号等数字内容使用等宽字体展示，便于对齐阅读。

**色彩令牌（深色默认值；浅色对应值在 globals.css 的 light 媒体查询中维护）**

| 用途 | 深色值 | 浅色值 | 说明 |
|------|------|------|------|
| 画布（页面背景） | `#010102` | `#fbfbfc` | 深色禁止用纯黑 `#000000` |
| 表面 1（卡片/面板） | `#0f1011` | `#ffffff` | 默认卡片背景 |
| 表面 2（选中/悬浮） | `#141516` | `#f4f5f6` | 选中项、强调卡片 |
| 表面 3（下拉/浮层） | `#18191a` | `#ececee` | 弹出菜单、浮层 |
| 发丝线（边框/分割线） | `#23252a` | `#e4e5e8` | 1px；强调线深 `#34343a` / 浅 `#cdced2` |
| 主文字 | `#f7f8f8` | `#17181a` | 标题与正文 |
| 次要文字 | `#d0d6e0` | `#3f434b` | 说明、元信息 |
| 辅助文字 | `#8a8f98` | `#6b7078` | 占位、标签 |
| 禁用文字 | `#62666d` | `#9b9fa7` | 不可用状态 |
| 主色（薰衣草蓝） | `#5e6ad2` | `#5e6ad2` | hover 深 `#828fff` / 浅 `#4b55b8` |
| 状态色（成功） | `#34b757` | `#1f9e43` | 工单状态可用低饱和红/橙/黄/蓝，仅限小面积徽章 |

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

- 卡片：`.card` 全局类（表面1 + 发丝线 + 12px 圆角）；选中态升到 `表面2`，不叠加阴影。
- 按钮：主按钮薰衣草蓝底白字 8px 圆角；次级按钮 `表面1` 底 + 发丝线边框；禁止胶囊形主按钮。
- 输入框：`表面1` 背景、8px 圆角；聚焦态用主色外描边。
- 状态徽章：`components/mobile/Badge.tsx`（pill 圆角、语义色低饱和底 + 同色文字、内边距 2px 8px）。
- 列表（工单列表等）：行与行之间用发丝线分割，不加投影。

**材质与动效（Apple 交互手感）**

- 浮层栏（顶部导航栏、底部标签栏、页面底部固定操作栏）使用半透明材质：令牌 `--canvas-translucent` / `--surface-1-translucent`（`rgba` 约 0.72 透明度）+ `backdrop-filter: blur(20px) saturate(180%)`，保留 1px 发丝线边框，内容从栏下滚过时隐约可见；导航栏用 NavBar 组件（fixed + 同高占位）。
- 底部弹窗（sheet）用更实材质 `--sheet-translucent`（约 0.86 透明度）+ 同参数模糊（BottomSheet 组件已内置）。
- 自定义固定底栏统一挂全局类 `material-bar`（globals.css 已定义背景 + 模糊）。
- 一切固定在底部（tabbar、操作栏、FAB、页面留白）必须预留 `env(safe-area-inset-bottom)`。
- 列表型页面（tab 页）使用 `page-frame` + `scroll-area` 骨架：页头（导航/搜索/tabs）固定，仅内容区独立滚动（`overscroll-behavior-y: contain` 防滚动穿透）；详情/表单页仍为整页滚动（`page-container`）+ 悬浮毛玻璃导航栏。
- 动效优先用弹簧（motion/react：`{ type: 'spring', bounce: 0, duration: 0.3~0.4 }` 临界阻尼）；数值滚动用 `useAnimatedYuan`（从「当前呈现值」续滚而非从 0 重滚）；图表生长动画只用 `transform: scaleY/scaleX`，不用 width/height 过渡。
- 按压反馈：自定义可点元素统一挂 `pressable` 类（按下 0.1s 内 `scale(0.97)`）；motion 元素用 `whileTap`；提交类按钮必须带 disabled/loading 防弱网双击重复提交。
- 路由过渡：tab 平级切换 `fade`（(tabs)/template.tsx），进入更深层级 `push` 右滑入（各详情路由的 template.tsx）；App Router 无退场动画（有意为之）。
- 无障碍兜底（globals.css 已内置）：`prefers-reduced-motion` 时过渡退化为淡入、图表动画关闭；`prefers-reduced-transparency` 时材质回退实色并关闭模糊。

**shadcn/Tailwind 适配要点**

- shadcn 主题变量（--background/--card/--border/--primary…）已在 globals.css 桥接到设计令牌，主题自动跟随系统；新增 shadcn 组件直接 `npx shadcn add` 即可继承。
- Tailwind 工具类可用于布局间距；颜色一律走 `var(--令牌)` 内联样式或既有全局类，不用 Tailwind 调色板类名（`bg-zinc-…` 等禁止）。
- 优先使用 `components/mobile/` 手写移动组件（BottomSheet/Cell/ScrollTabs/ImagePreview 等）；复杂浮层行为优先复用这些组件而不是重写。
- 图标统一 lucide-react，尺寸 14-24px，描边 1.6-1.8。

**禁止事项**

- 禁止绕过设计令牌硬编码颜色（双主题下另一主题必然异常）；禁止大面积彩色背景；禁止引入第二主题色；禁止渐变与聚光装饰；深色画布禁止纯黑 `#000000`；禁止用投影做层级（材质模糊 + 发丝线表达层级）；禁止动画用 width/height/top/left 等布局属性。

## 常用命令

```bash
# 安装依赖（根目录执行，实际装在 web/）
npm install

# 启动本地内嵌 PostgreSQL（首次自动初始化，无需 Docker）
npm run dev:db          # 启动（分离守护进程）
npm run db:stop         # 停止

# 开发服务器（需先配置 web/.env.local 的 DATABASE_URL，见 web/.env.example）
npm run dev             # http://localhost:3000

# 构建 / 生产启动
npm run build
npm start

# 数据库迁移
npm run db:migrate      # 开发：生成并应用迁移
npm run db:deploy       # 生产：应用已有迁移
npm run db:studio       # Prisma Studio 可视化

# 一键端到端验证（内嵌PG → 迁移 → 构建 → 服务 → 结算回归）
npm test
```

## 注意事项

- 单用户系统，采用**单访问密码**鉴权（无多用户/角色体系）：密码 scrypt 哈希存 `settings` 表，会话为 HMAC 签名的 httpOnly Cookie（30 天）；除 `/api/health` 与 `/api/auth` 外，所有 `/api` 均要求登录（`withAuth` 包装，新增后端接口默认继承）；登录接口带同 IP 防爆破锁定（计数存 `settings` 表，Serverless 多实例生效）；前端 401 统一跳 `/login`。
- 接车照片存 Vercel Blob：浏览器经 `@vercel/blob/client` 直传（`/api/upload/token` 下发受约束凭证，限图片 10MB），数据库存完整公开 URL（路径随机不可猜测）；删除走 `DELETE /api/upload`。
- 百度 OCR 密钥（`BAIDU_OCR_API_KEY/SECRET_KEY`）为可选配置，未配置时识别功能自动停用、前端回退手输。
- 生产部署在 Vercel（项目 Root Directory 设为 `web/`），`DATABASE_URL` 指向 Vercel Postgres/Neon；`postinstall` 已自动执行 `prisma generate`。
- 本地开发无 Docker 时用 `npm run dev:db` 起内嵌 PostgreSQL（端口 5433，数据在 `web/.pgdata`，已 gitignore）。
