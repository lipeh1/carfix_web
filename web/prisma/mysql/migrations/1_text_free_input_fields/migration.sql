-- 用户自由填写的字段由 VARCHAR(191) 改为 TEXT，避免 MySQL 严格模式下超长报错
ALTER TABLE `work_orders` MODIFY `cancel_reason` TEXT NULL;

ALTER TABLE `additional_items` MODIFY `reason` TEXT NULL;

ALTER TABLE `reminders` MODIFY `feedback` TEXT NULL;
