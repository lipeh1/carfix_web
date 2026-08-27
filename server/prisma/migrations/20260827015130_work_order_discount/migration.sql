-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "quote_amount" REAL,
    "discount" REAL NOT NULL DEFAULT 0,
    "final_amount" REAL,
    "paid_amount" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_work_orders" ("cancel_reason", "cancelled_at", "complaint", "created_at", "customer_id", "delivered_at", "final_amount", "id", "inspection", "mileage_in", "mileage_out", "order_no", "paid_amount", "quote_amount", "quote_confirmed_at", "repair_finished_at", "repair_started_at", "source", "status", "updated_at", "vehicle_id") SELECT "cancel_reason", "cancelled_at", "complaint", "created_at", "customer_id", "delivered_at", "final_amount", "id", "inspection", "mileage_in", "mileage_out", "order_no", "paid_amount", "quote_amount", "quote_confirmed_at", "repair_finished_at", "repair_started_at", "source", "status", "updated_at", "vehicle_id" FROM "work_orders";
DROP TABLE "work_orders";
ALTER TABLE "new_work_orders" RENAME TO "work_orders";
CREATE UNIQUE INDEX "work_orders_order_no_key" ON "work_orders"("order_no");
CREATE INDEX "work_orders_customer_id_idx" ON "work_orders"("customer_id");
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicle_id");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
