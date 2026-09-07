-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_additional_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_order_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "additional_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_additional_items" ("amount", "confirmed_at", "created_at", "id", "name", "reason", "status", "work_order_id") SELECT "amount", "confirmed_at", "created_at", "id", "name", "reason", "status", "work_order_id" FROM "additional_items";
DROP TABLE "additional_items";
ALTER TABLE "new_additional_items" RENAME TO "additional_items";
CREATE INDEX "additional_items_work_order_id_idx" ON "additional_items"("work_order_id");
CREATE TABLE "new_payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "settlement_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "type" TEXT NOT NULL DEFAULT 'initial',
    "remark" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "created_at", "id", "method", "remark", "settlement_id", "type") SELECT "amount", "created_at", "id", "method", "remark", "settlement_id", "type" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE INDEX "payments_settlement_id_idx" ON "payments"("settlement_id");
CREATE TABLE "new_repair_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_order_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "remark" TEXT,
    "source" TEXT NOT NULL DEFAULT 'quote',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_repair_items" ("created_at", "id", "name", "quantity", "remark", "source", "subtotal", "type", "unit_price", "work_order_id") SELECT "created_at", "id", "name", "quantity", "remark", "source", "subtotal", "type", "unit_price", "work_order_id" FROM "repair_items";
DROP TABLE "repair_items";
ALTER TABLE "new_repair_items" RENAME TO "repair_items";
CREATE INDEX "repair_items_work_order_id_idx" ON "repair_items"("work_order_id");
CREATE TABLE "new_settlements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_order_id" INTEGER NOT NULL,
    "settlement_no" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "actual_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "remark" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlements_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_settlements" ("actual_amount", "created_at", "discount", "id", "paid_amount", "remark", "settlement_no", "status", "total_amount", "work_order_id") SELECT "actual_amount", "created_at", "discount", "id", "paid_amount", "remark", "settlement_no", "status", "total_amount", "work_order_id" FROM "settlements";
DROP TABLE "settlements";
ALTER TABLE "new_settlements" RENAME TO "settlements";
CREATE UNIQUE INDEX "settlements_work_order_id_key" ON "settlements"("work_order_id");
CREATE UNIQUE INDEX "settlements_settlement_no_key" ON "settlements"("settlement_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

