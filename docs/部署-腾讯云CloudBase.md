# 部署到腾讯云 CloudBase 云托管（中国大陆公网可访问）

> 本文是当前唯一的正式部署方案。原 Vercel 部署（`*.vercel.app`）在中国大陆无法直连，已停止维护。

## 一、为什么换平台

| 项 | Vercel 现状 | 大陆可用性 |
|---|---|---|
| 托管 | `carweb-dusky.vercel.app` | ❌ `*.vercel.app` 域名被 DNS 污染 |
| 数据库 | Vercel Postgres（Neon，境外） | ❌ 跨境连接，延迟 300ms+ 且抖动 |
| 图片 | Vercel Blob 客户端直传 | ❌ 同上，上传经常失败 |

迁移后：**云托管（Next.js 容器）+ 云开发 MySQL + 腾讯云 COS**，全部在境内，免运维、按量计费。

## 二、目标架构

```
手机浏览器 / PWA
      │  HTTPS
      ▼
CloudBase 云托管（容器，Node 22 + Next.js standalone，端口 3000）
      │                        │
      │ 内网（VPC）             │ 公网 HTTPS
      ▼                        ▼
云开发 MySQL（3306/tcb）    腾讯云 COS（checkin/ 目录，公开读）
```

- **应用**：一个 Docker 镜像，含 SSR、API Route Handlers、PWA Service Worker
- **数据库**：云开发 MySQL（Serverless，空闲自动暂停）
- **图片**：COS 桶，对象路径 `checkin/<时间戳>-<随机串>.<ext>`，文件名不可猜测
- **迁移**：容器启动时自动执行 `prisma migrate deploy`，无需手工建表

## 三、开工前必须知道的一件事（备案）

云托管会给每个服务分配默认域名：

```
https://<服务名>-<随机串>.<地域>.app.tcloudbase.com
```

**这个默认域名只能用于测试**，平台对它有明确限制（官方文档《默认域名访问限制及中间页》）：

1. 浏览器直接访问会先弹一个「当前环境仅供开发测试」的中间页，访客点「确定访问」才能进；
2. 非导航类请求（图片、JS 等）会被加上 `Content-Disposition: attachment`，部分场景浏览器会变成下载；
3. 访问量异常会被风控关停。

要正常使用，**必须绑定自定义域名，而自定义域名必须完成 ICP 备案**（这是工信部要求，不是腾讯云的额外规定）。

好消息：云开发环境本身可以作为备案的接入资源，**不需要额外买服务器**，在腾讯云备案系统里选该 CloudBase 环境即可。

所以推荐节奏：

| 时间 | 做什么 |
|---|---|
| 第 1 天 | 买域名 → 实名认证 → 提交 ICP 备案；同时按本文把服务部署到默认域名，功能全部跑通 |
| 备案期间（约 1–20 个工作日） | 用默认域名验收、录数据、试跑业务 |
| 备案通过后 | 在云托管绑定自定义域名（自动签发免费证书），去掉中间页，正式交付 |

> 如果不想等备案：可选香港节点服务器（免备案，大陆访问 30–80ms），但那是另一套部署方式（Docker + 自建 PG/COS），需要时再说。

## 四、第 1 步：创建云开发环境

1. 注册腾讯云账号并完成实名认证。
2. 打开 [云开发控制台](https://tcb.cloud.tencent.com/dev)，新建环境：
   - 计费方式：**按量计费**
   - 地域：**上海**（离多数门店近，且与后文 COS 保持一致）
   - 记下**环境 ID**（形如 `carweb-8gxxxxxx`），后面多处要用。

## 五、第 2 步：开通云开发 MySQL

1. 控制台左侧「数据库 → MySQL」，首次进入按提示初始化：选择**私有网络 VPC 与子网**（没有就新建一个，记下 VPC 名称）。
2. 进入「数据库设置」，复制**内网连接地址**，拼成连接串：

```
mysql://root:<密码>@<内网地址>:3306/tcb
```

3. 这个串就是 `DATABASE_URL`。**表结构不用手动建**，容器首次启动会自动跑迁移。

> 云开发 MySQL 默认库名是 `tcb`，与迁移文件无冲突（迁移只建表，不建库）。

## 六、第 3 步：开通对象存储 COS

1. 控制台「对象存储」新建存储桶：
   - 名称：`carweb-<你的APPID>`（必须带 APPID 后缀）
   - 地域：与云托管同地域（上海 `ap-shanghai`）
   - 访问权限：**公有读私有写**
2. 记下桶名 `COS_BUCKET` 与地域 `COS_REGION`。
3. 创建子账号密钥（推荐，别用主账号密钥）：
   - 访问管理 → 用户 → 新建子用户，编程访问
   - 只授予 `QcloudCOSDataFullControl` 或自定义策略限定到该桶
   - 记下 `SecretId` / `SecretKey`

图片 URL 形如 `https://carweb-1250000000.cos.ap-shanghai.myqcloud.com/checkin/1730000000000-a1b2c3d4e5.jpg`，COS 源站域名可直接被 `<img>` 加载，**不需要备案**。

> 想更快：给桶绑 CDN 加速域名，把域名填到 `COS_PUBLIC_BASE`，图片走 CDN。

## 七、第 4 步：部署云托管服务

三种方式任选，推荐 **Git 部署**（可审计、push 即发布）。

### 方式 A：Git 仓库部署（推荐）

1. 把代码推到 GitHub / 工蜂。
2. 控制台「云托管 → 新建服务」：
   - 服务名称：`carweb`
   - 部署方式：Git 仓库，**代码目录填 `web`**（Dockerfile 在 `web/Dockerfile`，构建上下文必须是 `web/`）
   - 端口：**3000**
   - 规格：0.5 核 1G 起步；最小实例数 0（无访问不计费）、最大 2
3. 首次部署前先在「服务设置 → 环境变量」里配好下表，再触发构建。

### 方式 B：本地代码部署

控制台「通过本地代码部署」，上传 `web/` 目录（不要传 `node_modules`、`.next`、`.pgdata`、`.env.local`），端口同样填 3000。

### 方式 C：CLI 部署

```bash
npm i -g @cloudbase/cli
tcb login
cd web
tcb cloudrun deploy --port 3000
# 按提示选择环境 ID、填服务名 carweb、开启公网访问
```

CLI 会把 `web/` 作为构建上下文上传，云端用 `Dockerfile` 构建镜像。

### 关键配置：私有网络

服务创建后，进「服务配置 → 网络配置」，**开启私有网络并选择云开发 MySQL 所在的 VPC**。不开这一步，容器连不上数据库，表现为启动日志里 Prisma 连接超时。

## 八、环境变量清单

在「服务设置 → 环境变量」中配置（全部为服务端变量，不涉及 `NEXT_PUBLIC_*`）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | `mysql://root:密码@内网地址:3306/tcb`，密码含 `@ : / #` 等字符需 URL 编码（如 `@` → `%40`） |
| `COS_SECRET_ID` | ✅ | 子账号 SecretId |
| `COS_SECRET_KEY` | ✅ | 子账号 SecretKey |
| `COS_BUCKET` | ✅ | 形如 `carweb-1250000000` |
| `COS_REGION` | ✅ | 如 `ap-shanghai` |
| `STORAGE_DRIVER` | ⬜ | 固定填 `cos`（不填时按有无 `COS_BUCKET` 自动判断） |
| `COS_PUBLIC_BASE` | ⬜ | CDN 加速域名，留空用 COS 源站域名 |
| `OCR_AGENT_BASE_URL` | ⬜ | Agent 接口地址，默认 `https://api.deepseek.com` |
| `OCR_AGENT_MODEL` | ⬜ | 支持图片输入的模型，默认 `deepseek-flash` |
| `OCR_AGENT_API_KEY` | ⬜ | Agent 服务端密钥；图片通过后端发送，不下发给浏览器 |
| `ICP_BEIAN` | ⬜ | 备案通过后填，如 `粤ICP备2026123456号-1`，展示在登录页底部 |
| `POLICE_BEIAN` | ⬜ | 公安联网备案通过后填，如 `粤公网安备 44030502001234号` |

> 环境变量改动需要**新建版本并发布**才生效。

## 九、第 5 步：验收

部署完成后：

1. 打开默认域名，首次访问会先出中间页，点「确定访问」。
2. 进入应用后是设密码页，设置访问密码，**记下恢复码**（只显示一次）。
3. 依次验收：接车登记 → 拍照上传（确认图片能显示）→ 检测报价 → 结算 → 交车 → 提醒。
4. 检查容器日志无 Prisma 报错；`/api/health` 返回 200。

图片上传的两种驱动：

- 生产 `STORAGE_DRIVER=cos`：文件进 COS，URL 是 `https://<bucket>.cos.<region>.myqcloud.com/checkin/...`
- 本地开发 `local`：文件落 `web/.uploads/`，URL 是 `/api/files/checkin/...`，由路由读盘回源

## 十、第 6 步：绑定自定义域名（备案通过后）

1. 云托管「服务 → 自定义域名 → 添加域名」，填 `carweb.example.com`。
2. 平台给出一条 CNAME，去域名 DNS 加记录。
3. 证书选「自动申请免费证书」。
4. 状态变「已生效」后即可用自有域名访问，中间页消失。

### 备案通过后的三件必做事

| 事项 | 时限 | 做法 |
|---|---|---|
| 展示 ICP 备案号 | 立即 | 环境变量配 `ICP_BEIAN=粤ICP备2026xxxxxx号-1`，重新发版；登录页底部会自动出现并链接工信部 |
| 公安联网备案 | 备案通过后 **30 日内** | 到 [全国互联网安全管理服务平台](https://beian.mps.gov.cn/) 用同一主体登记，拿到号后配 `POLICE_BEIAN` 并发版 |
| 域名续费提醒 | 到期前 | 建议开自动续费，域名过期会导致备案被注销 |

> 备案号由 `/api/site-info` 运行时读取环境变量，**改完变量新建版本发布即可生效，不需要改代码**。

## 十一、日常发布与运维

| 操作 | 做法 |
|---|---|
| 发版 | Git 部署：push 到部署分支自动构建；CLI：重新执行 `tcb cloudrun deploy` |
| 改表结构 | 改 `prisma/schema.prisma` → `npm run db:mysql:gen` 重新生成 MySQL 版 → 用 `npm run db:mysql:diff` 生成增量 SQL 放进 `prisma/mysql/migrations/<时间戳>_xxx/migration.sql` → 发版（容器启动自动执行） |
| 回滚 | 云托管「版本管理」把流量切回上一个版本 |
| 日志 | 云托管「部署历史 / 实例日志」 |
| 数据库备份 | 云开发 MySQL 控制台开启备份，或定期导出 |
| 忘记访问密码 | 环境变量加 `RESET_PASSWORD=1` 发一次版，容器启动时清空密码哈希，重进设密流程；**完成后立刻删掉该变量** |

> 重置通道由容器入口脚本实现（`web/docker-entrypoint.sh`）：检测到 `RESET_PASSWORD` 时执行 `DELETE FROM settings WHERE key='auth:password' ...`，所以改完变量要**新建版本发布**才会触发。

## 十二、从旧 Vercel 库迁数据（可选）

如果线上已有真实业务数据，需要把 PostgreSQL 数据搬到 MySQL。推荐做法：

1. 本地用旧连接串导出：`pg_dump` 或写脚本用 Prisma 逐表读成 JSON；
2. 本地把 `DATABASE_URL` 指向云开发 MySQL 的**公网地址**（若未开放公网，可临时在本机用 COS + 内网不通时改用「云托管一次性任务」跑导入脚本）；
3. 按外键顺序导入：`customers → vehicles → work_orders → checkin_records → ...`，并重置自增序列。

需要的话可以让 AI 生成一份 `scripts/migrate-pg-to-mysql.mjs`（逐表导出 JSON → 按依赖顺序插入 → 修正自增起点）。

## 十三、成本量级（参考，以控制台账单为准）

单店单用户、日均几十次请求的场景：

| 项 | 量级 |
|---|---|
| 云托管（0.25 核 0.5G，常驻 1 实例） | 约 ¥20–40/月 |
| 云开发 MySQL（低 CCU，空闲暂停） | 约 ¥10–60/月 |
| COS 存储 + 流量（几 GB 图片） | 几元/月 |
| 域名 | 约 ¥30–60/年 |

合计大致 **¥30–100/月**。把云托管「最小实例数」设为 0 可进一步降本，代价是冷启动多 1–3 秒。

## 十四、排障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 容器启动即退出，日志 `Can't reach database server` | 未开私有网络 / VPC 选错 | 服务配置 → 网络配置 → 选 MySQL 所在 VPC |
| 启动日志 `P1001` | `DATABASE_URL` 用了公网地址或密码错 | 换内网地址，核对密码 |
| 页面 502 / 503 | 端口不是 3000，或没绑 `HOSTNAME=0.0.0.0` | 服务端口填 3000；Dockerfile 已内置该变量 |
| CSS/JS 全 404 | 镜像漏拷 `.next/static` | Dockerfile 已处理，确认没改坏 `COPY` 行 |
| 上传图片报「对象存储未配置」 | COS 四个变量缺一个 | 补齐并重新发版 |
| 图片 403 | 桶是私有读 | 桶权限改「公有读私有写」，或给对象加 `public-read`（代码已带 ACL） |
| 访问弹「仅供开发测试」 | 用的默认域名 | 正常现象，绑自定义域名后消失 |
| 构建卡在 `npm ci` | 构建机访问 npm 官方源慢 | Dockerfile 已默认 `registry.npmmirror.com`，可用 `--build-arg NPM_REGISTRY=...` 覆盖 |
