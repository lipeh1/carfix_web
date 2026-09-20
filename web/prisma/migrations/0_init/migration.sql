-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "plate_number" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "color" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
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
    "quote_confirmed_at" TIMESTAMP(3),
    "repair_started_at" TIMESTAMP(3),
    "repair_finished_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_records" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "vehicle_condition" TEXT,
    "fuel_level" TEXT,
    "items_in_car" TEXT,
    "checkin_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_photos" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_items" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "remark" TEXT,
    "source" TEXT NOT NULL DEFAULT 'quote',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_logs" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_items" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "additional_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "check_items" TEXT,
    "remark" TEXT,
    "checked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "settlement_no" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "actual_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "settlement_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "type" TEXT NOT NULL DEFAULT 'initial',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" SERIAL NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "remind_date" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reminded_at" TIMESTAMP(3),
    "remind_method" TEXT,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "vehicles_customer_id_idx" ON "vehicles"("customer_id");

-- CreateIndex
CREATE INDEX "vehicles_plate_number_idx" ON "vehicles"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_order_no_key" ON "work_orders"("order_no");

-- CreateIndex
CREATE INDEX "work_orders_customer_id_idx" ON "work_orders"("customer_id");

-- CreateIndex
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicle_id");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_records_work_order_id_key" ON "checkin_records"("work_order_id");

-- CreateIndex
CREATE INDEX "checkin_photos_work_order_id_idx" ON "checkin_photos"("work_order_id");

-- CreateIndex
CREATE INDEX "repair_items_work_order_id_idx" ON "repair_items"("work_order_id");

-- CreateIndex
CREATE INDEX "repair_logs_work_order_id_idx" ON "repair_logs"("work_order_id");

-- CreateIndex
CREATE INDEX "additional_items_work_order_id_idx" ON "additional_items"("work_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_checks_work_order_id_key" ON "quality_checks"("work_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_work_order_id_key" ON "settlements"("work_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlement_no_key" ON "settlements"("settlement_no");

-- CreateIndex
CREATE INDEX "payments_settlement_id_idx" ON "payments"("settlement_id");

-- CreateIndex
CREATE INDEX "reminders_work_order_id_idx" ON "reminders"("work_order_id");

-- CreateIndex
CREATE INDEX "reminders_vehicle_id_idx" ON "reminders"("vehicle_id");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_records" ADD CONSTRAINT "checkin_records_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_photos" ADD CONSTRAINT "checkin_photos_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_items" ADD CONSTRAINT "repair_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_logs" ADD CONSTRAINT "repair_logs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_items" ADD CONSTRAINT "additional_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

