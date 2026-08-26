# 汽修管理系统 - 功能拆分与数据库设计

> 单用户移动端 Web 应用，技术栈：Vue3 + TypeScript + Vant + Express + SQLite + Prisma

---

## 一、功能模块拆分

按移动端页面维度，共 **11 个功能模块**：

### 1. 首页工作台 `/`
- 今日工单数量概览（待接车 / 维修中 / 待结算 / 已完成）
- 待办提醒卡片（到期保养、待回访、挂账未收）
- 快捷入口：新建接车、客户列表、工单列表
- 本月营收金额展示

### 2. 客户管理 `/customers`
- 客户列表（搜索姓名/电话，按最近到店排序）
- 客户详情（基本信息 + 名下车辆 + 历史工单）
- 新增/编辑客户（姓名、电话、备注）

### 3. 车辆管理 `/vehicles`
- 车辆列表（搜索车牌号，关联客户）
- 车辆详情（车辆信息 + 完整维修历史 + 下次保养提醒）
- 新增/编辑车辆（车牌号、品牌、车型、年份、VIN、备注）

### 4. 接车登记 `/checkin`
- 选择已有客户 / 快速新建客户
- 选择客户名下车辆 / 快速新建车辆
- 录入：客户诉求、当前里程、车况描述
- 上传接车照片（多角度拍照/相册选择，支持多张）
- 提交 → 自动创建工单，状态为「待检测」

### 5. 工单管理 `/orders`
- 工单列表（Tab 筛选：全部 / 待检测 / 待报价确认 / 维修中 / 待质检 / 待结算 / 已完成 / 已取消）
- 工单详情（全流程信息聚合：接车信息、照片、检测、报价、维修记录、增项、质检、结算）
- 工单状态流转操作按钮（根据当前状态动态显示）

### 6. 检测与报价 `/orders/:id/quote`
- 录入检测结果（故障描述）
- 添加维修项目（项目名称、工时费）
- 添加配件（配件名称、数量、单价）
- 自动计算报价总金额
- 生成报价单 → 客户确认（确认 / 要求调整 / 取消维修）
- 要求调整时可返回修改项目和配件

### 7. 维修施工 `/orders/:id/repair`
- 记录维修过程（文字描述，可多条追加）
- 新增增项（项目名称、费用、原因说明）
- 增项客户确认（确认 / 拒绝）
- 确认增项后自动并入工单，金额追加
- 标记维修完成 → 进入质检

### 8. 质检与结算 `/orders/:id/checkout`
- 完工自检（检查项勾选 + 备注 + 是否通过）
- 不通过 → 返回维修中（返工）
- 通过 → 生成结算单（自动汇总项目费 + 配件费 + 增项费）
- 收款操作：
  - 全额收款 → 标记已结清
  - 挂账/部分收款 → 记录待付金额，支持后续补款
- 补款记录（多次收款累计）

### 9. 交车 `/orders/:id/deliver`
- 交车确认（交车里程、交车时间）
- 发送维修单据（可生成单据图片/PDF，微信发送）
- 交车后工单状态变为「已完成」
- 自动写入车辆维修历史
- 自动创建保养/回访提醒

### 10. 回访提醒 `/reminders`
- 提醒列表（Tab：待提醒 / 已提醒 / 全部）
- 类型区分：保养提醒、回访提醒
- 提醒详情（关联工单和车辆，建议提醒时间）
- 标记已提醒（记录提醒时间、提醒方式、客户反馈）
- 首页待办自动展示即将到期的提醒

### 11. 统计报表 `/stats`
- 月度营收趋势（按月统计收款金额）
- 工单数量统计（按月/按状态）
- 维修项目热度排行
- 挂账金额汇总

---

## 二、工单状态机（核心流转）

```
待检测 → 待报价确认 → 维修中 → 待质检 → 待结算 → 已完成
                ↓          ↑                  ↑
             已取消      增项确认           质检不通过(返工)
```

| 状态值 | 说明 | 可执行操作 |
|--------|------|-----------|
| `pending_inspection` | 待检测 | 录入检测 → 生成报价 |
| `pending_quote` | 待报价确认 | 客户确认 / 要求调整 / 取消 |
| `repairing` | 维修中 | 记录维修 / 新增增项 / 标记完成 |
| `pending_quality_check` | 待质检 | 自检通过 / 不通过返工 |
| `pending_settlement` | 待结算 | 收款 / 挂账 |
| `completed` | 已完成 | 交车后终态 |
| `cancelled` | 已取消 | 客户取消维修 |

---

## 三、数据库表设计

共 **12 张表**，SQLite + Prisma。

### 表关系总览

```
customers 1───N vehicles
customers 1───N work_orders
vehicles  1───N work_orders
work_orders 1───1 checkin_records
work_orders 1───N checkin_photos
work_orders 1───N repair_items
work_orders 1───N repair_logs
work_orders 1───N additional_items
work_orders 1───1 quality_checks
work_orders 1───1 settlements
settlements 1───N payments
work_orders 1───N reminders
```

---

### 1. customers 客户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| name | String | not null | 客户姓名 |
| phone | String | unique | 联系电话 |
| address | String? | | 地址（可选） |
| remark | String? | | 备注（可选） |
| created_at | DateTime | default now() | 创建时间 |
| updated_at | DateTime | updated at | 更新时间 |

---

### 2. vehicles 车辆表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| customer_id | Integer | FK → customers.id, not null | 所属客户 |
| plate_number | String | not null, indexed | 车牌号 |
| brand | String? | | 品牌（如丰田） |
| model | String? | | 车型（如卡罗拉） |
| year | Integer? | | 年份 |
| vin | String? | | 车架号VIN |
| color | String? | | 车身颜色 |
| remark | String? | | 备注 |
| created_at | DateTime | default now() | 创建时间 |
| updated_at | DateTime | updated at | 更新时间 |

---

### 3. work_orders 工单表（核心）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| order_no | String | unique, not null | 工单号（如 WO20260826001） |
| customer_id | Integer | FK → customers.id, not null | 客户 |
| vehicle_id | Integer | FK → vehicles.id, not null | 车辆 |
| status | String | not null, default `pending_inspection` | 工单状态（见状态机） |
| source | String | default `walk_in` | 到店方式：`walk_in`(直接到店) / `appointment`(预约) |
| complaint | String? | | 客户诉求 |
| mileage_in | Integer? | | 接车里程 |
| mileage_out | Integer? | | 交车里程 |
| quote_amount | Decimal? | | 报价金额 |
| final_amount | Decimal? | | 最终结算金额 |
| paid_amount | Decimal? | default 0 | 已收金额 |
| quote_confirmed_at | DateTime? | | 报价确认时间 |
| repair_started_at | DateTime? | | 开始维修时间 |
| repair_finished_at | DateTime? | | 维修完成时间 |
| delivered_at | DateTime? | | 交车时间 |
| cancelled_at | DateTime? | | 取消时间 |
| cancel_reason | String? | | 取消原因 |
| created_at | DateTime | default now() | 创建时间 |
| updated_at | DateTime | updated at | 更新时间 |

---

### 4. checkin_records 接车登记表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, unique, not null | 关联工单（一对一） |
| vehicle_condition | String? | | 车况描述 |
| fuel_level | String? | | 油量（如 半箱/满箱） |
| items_in_car | String? | | 车内物品说明 |
| checkin_by | String? | | 接车人（单用户可固定） |
| created_at | DateTime | default now() | 接车时间 |

---

### 5. checkin_photos 接车照片表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, not null | 关联工单 |
| file_path | String | not null | 图片存储路径（相对路径） |
| description | String? | | 照片说明（如 左前剐蹭） |
| created_at | DateTime | default now() | 上传时间 |

---

### 6. repair_items 维修项目/配件明细表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, not null | 关联工单 |
| type | String | not null | 类型：`service`(工时项目) / `part`(配件) |
| name | String | not null | 项目/配件名称 |
| quantity | Decimal | default 1 | 数量 |
| unit_price | Decimal | not null | 单价 |
| subtotal | Decimal | not null | 小计（quantity × unit_price） |
| remark | String? | | 备注 |
| source | String | default `quote` | 来源：`quote`(报价项目) / `additional`(增项并入) |
| created_at | DateTime | default now() | 创建时间 |

---

### 7. repair_logs 维修过程记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, not null | 关联工单 |
| content | String | not null | 维修过程描述 |
| created_at | DateTime | default now() | 记录时间 |

---

### 8. additional_items 增项表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, not null | 关联工单 |
| name | String | not null | 增项名称 |
| amount | Decimal | not null | 增项费用 |
| reason | String? | | 新增原因说明 |
| status | String | default `pending` | 状态：`pending`(待确认) / `confirmed`(已确认) / `rejected`(已拒绝) |
| confirmed_at | DateTime? | | 客户确认时间 |
| created_at | DateTime | default now() | 创建时间 |

---

### 9. quality_checks 质检表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, unique, not null | 关联工单（一对一） |
| result | String | not null | 结果：`pass`(通过) / `fail`(不通过) |
| check_items | String? | | 检查项（JSON数组，存勾选情况） |
| remark | String? | | 质检备注 |
| checked_by | String? | | 质检人 |
| created_at | DateTime | default now() | 质检时间 |

---

### 10. settlements 结算单表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, unique, not null | 关联工单（一对一） |
| settlement_no | String | unique, not null | 结算单号 |
| total_amount | Decimal | not null | 应收总金额 |
| discount | Decimal? | default 0 | 优惠金额 |
| actual_amount | Decimal | not null | 实收金额（total - discount） |
| paid_amount | Decimal | default 0 | 已收金额 |
| status | String | default `unpaid` | 状态：`paid`(已结清) / `unpaid`(未结清/挂账) |
| remark | String? | | 备注 |
| created_at | DateTime | default now() | 结算时间 |

---

### 11. payments 收款记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| settlement_id | Integer | FK → settlements.id, not null | 关联结算单 |
| amount | Decimal | not null | 收款金额 |
| method | String | default `cash` | 收款方式：`cash`(现金) / `wechat`(微信) / `alipay`(支付宝) / `card`(刷卡) / `transfer`(转账) |
| type | String | default `initial` | 类型：`initial`(首次收款) / `supplement`(补款) |
| remark | String? | | 备注 |
| created_at | DateTime | default now() | 收款时间 |

---

### 12. reminders 回访/保养提醒表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| work_order_id | Integer | FK → work_orders.id, not null | 关联工单 |
| vehicle_id | Integer | FK → vehicles.id, not null | 关联车辆 |
| type | String | not null | 类型：`maintenance`(保养提醒) / `follow_up`(回访提醒) |
| remind_date | DateTime | not null | 建议提醒日期 |
| content | String? | | 提醒内容（如 5000公里后保养 / 3天后回访） |
| status | String | default `pending` | 状态：`pending`(待提醒) / `done`(已提醒) |
| reminded_at | DateTime? | | 实际提醒时间 |
| remind_method | String? | | 提醒方式：`phone`(电话) / `wechat`(微信) |
| feedback | String? | | 客户反馈 |
| created_at | DateTime | default now() | 创建时间 |

---

## 四、关键金额计算规则

1. **报价金额** = 所有 `repair_items`(source=quote) 的 subtotal 之和
2. **最终结算金额** = 报价项目 + 已确认增项金额 - 优惠
3. **已收金额** = 该结算单下所有 `payments` 的 amount 之和
4. **挂账金额** = actual_amount - paid_amount（>0 即为挂账）
5. 每次收款后自动更新 settlements.paid_amount 和 work_orders.paid_amount，若 paid ≥ actual 则状态置为 `paid`

---

## 五、工单号/结算单号生成规则

- 工单号：`WO` + `YYYYMMDD` + 3位当日序号，如 `WO20260826001`
- 结算单号：`SET` + `YYYYMMDD` + 3位当日序号，如 `SET20260826001`
- 当日序号查询当天最大号 +1，SQLite 用 `COUNT` 或 `MAX` 实现

---

## 六、自动触发规则

| 触发时机 | 自动动作 |
|---------|---------|
| 接车登记提交 | 创建 work_order（status=pending_inspection）+ 创建 checkin_record |
| 客户确认报价 | 更新 work_order.status=repairing, quote_confirmed_at |
| 客户确认增项 | 增项 status=confirmed，自动生成 repair_items(source=additional)，更新 final_amount |
| 标记维修完成 | work_order.status=pending_quality_check, repair_finished_at |
| 质检通过 | work_order.status=pending_settlement，自动创建 settlement |
| 质检不通过 | work_order.status=repairing（返工） |
| 收款后结清 | settlement.status=paid |
| 交车确认 | work_order.status=completed, delivered_at，自动创建 reminders（保养+回访各一条） |
