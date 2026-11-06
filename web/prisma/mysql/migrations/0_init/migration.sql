-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `plate_number` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `vin` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vehicles_customer_id_idx`(`customer_id`),
    INDEX `vehicles_plate_number_idx`(`plate_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(191) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `vehicle_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending_inspection',
    `source` VARCHAR(191) NOT NULL DEFAULT 'walk_in',
    `complaint` TEXT NULL,
    `inspection` TEXT NULL,
    `mileage_in` INTEGER NULL,
    `mileage_out` INTEGER NULL,
    `quote_amount` INTEGER NULL,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `final_amount` INTEGER NULL,
    `paid_amount` INTEGER NOT NULL DEFAULT 0,
    `quote_confirmed_at` DATETIME(3) NULL,
    `repair_started_at` DATETIME(3) NULL,
    `repair_finished_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `work_orders_order_no_key`(`order_no`),
    INDEX `work_orders_customer_id_idx`(`customer_id`),
    INDEX `work_orders_vehicle_id_idx`(`vehicle_id`),
    INDEX `work_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkin_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `vehicle_condition` TEXT NULL,
    `fuel_level` VARCHAR(191) NULL,
    `items_in_car` TEXT NULL,
    `checkin_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `checkin_records_work_order_id_key`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkin_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `checkin_photos_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 1,
    `unit_price` INTEGER NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `remark` TEXT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'quote',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `repair_items_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `repair_logs_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `additional_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `additional_items_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_checks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `result` VARCHAR(191) NOT NULL,
    `check_items` TEXT NULL,
    `remark` TEXT NULL,
    `checked_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `quality_checks_work_order_id_key`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `settlement_no` VARCHAR(191) NOT NULL,
    `total_amount` INTEGER NOT NULL,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `actual_amount` INTEGER NOT NULL,
    `paid_amount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unpaid',
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `settlements_work_order_id_key`(`work_order_id`),
    UNIQUE INDEX `settlements_settlement_no_key`(`settlement_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settlement_id` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `method` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `type` VARCHAR(191) NOT NULL DEFAULT 'initial',
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_settlement_id_idx`(`settlement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `vehicle_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `remind_date` DATETIME(3) NOT NULL,
    `content` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `reminded_at` DATETIME(3) NULL,
    `remind_method` VARCHAR(191) NULL,
    `feedback` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reminders_work_order_id_idx`(`work_order_id`),
    INDEX `reminders_vehicle_id_idx`(`vehicle_id`),
    INDEX `reminders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkin_records` ADD CONSTRAINT `checkin_records_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkin_photos` ADD CONSTRAINT `checkin_photos_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_items` ADD CONSTRAINT `repair_items_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_logs` ADD CONSTRAINT `repair_logs_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_items` ADD CONSTRAINT `additional_items_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quality_checks` ADD CONSTRAINT `quality_checks_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

