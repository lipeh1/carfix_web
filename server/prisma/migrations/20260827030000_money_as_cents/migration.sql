-- 金额字段 Float→Int，改为整数"分"存储
--
-- 说明：本迁移首次执行时在 work_orders 步骤失败（建表已成立但未替换），
-- additional_items / payments / repair_items / settlements 四表已完成重建、
-- 但搬数按原值复制。本文件为针对该库状态的修订版：
--   1. 清理残留的 new_work_orders
--   2. 已重建的四表补执行 ×100 换算（元→分）
--   3. work_orders 完整重建并在搬数时 ×100
-- 如需在其他环境回放，请先按注释拆分步骤确认各表状态。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. 清理上次失败残留的新工单表
DROP TABLE IF EXISTS "new_work_orders";

-- 2. 已完成类型重建的四张表：金额由元换算为分
UPDATE "additional_items" SET "amount" = "amount" * 100;
UPDATE "payments" SET "amount" = "amount" * 100;
UPDATE "repair_items" SET "unit_price" = "unit_price" * 100, "subtotal" = "subtotal" * 100;
UPDATE "settlements"
   SET "total_amount" = "total_amount" * 100,
       "discount" = "discount" * 100,
       "actual_amount" = "actual_amount" * 100,
       "paid_amount" = "paid_amount" * 100;

-- 3. work_orders 重建（Float→Int），搬数同步 ×100；NULL×100 保持 NULL
CREATE TABLE "new_work_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_no" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_inspection',
    "source" TEXT NOT NULL DEFAULT 'walk_in',
    "complaint" TEXT,
    "inspection" TEXT,
    "mileage_in" INTEGER,
    "mileage_out" INTEGER,
    "quote_amount" INTEGER,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "final_amount" INTEGER,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "quote_confirmed_at" DATETIME,
    "repair_started_at" DATETIME,
    "repair_finished_at" DATETIME,
    "delivered_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancel_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_work_orders" ("cancel_reason", "cancelled_at", "complaint", "created_at", "customer_id", "delivered_at", "discount", "final_amount", "id", "inspection", "mileage_in", "mileage_out", "order_no", "paid_amount", "quote_amount", "quote_confirmed_at", "repair_finished_at", "repair_started_at", "source", "status", "updated_at", "vehicle_id")
SELECT "cancel_reason", "cancelled_at", "complaint", "created_at", "customer_id", "delivered_at", "discount" * 100, "final_amount" * 100, "id", "inspection", "mileage_in", "mileage_out", "order_no", "paid_amount" * 100, "quote_amount" * 100, "quote_confirmed_at", "repair_finished_at", "repair_started_at", "source", "status", "updated_at", "vehicle_id" FROM "work_orders";
DROP TABLE "work_orders";
ALTER TABLE "new_work_orders" RENAME TO "work_orders";
CREATE UNIQUE INDEX "work_orders_order_no_key" ON "work_orders"("order_no");
CREATE INDEX "work_orders_customer_id_idx" ON "work_orders"("customer_id");
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicle_id");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ============================================================================
-- 附：对当前 dev.db 的数值层级修正（本迁移在此库执行过一次失败尝试，
-- 各表已处于混合换算状态）。以下 UPDATE 将重复叠加的一层剥离，
-- 使全库金额统一为「原始元值 × 100」。若在新库从零回放本迁移，
-- 请勿执行本节，直接以上方结构化步骤为准。
-- ============================================================================
UPDATE "additional_items" SET "amount" = "amount" / 100;
UPDATE "payments" SET "amount" = "amount" / 100;
UPDATE "repair_items" SET "unit_price" = "unit_price" / 100, "subtotal" = "subtotal" / 100;
UPDATE "settlements"
   SET "actual_amount" = "actual_amount" / 100,
       "paid_amount" = "paid_amount" / 100;

