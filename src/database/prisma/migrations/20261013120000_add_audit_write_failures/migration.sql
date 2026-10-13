CREATE TABLE `audit_write_failures` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `actor_id` INTEGER NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` INTEGER NULL,
  `request_id` VARCHAR(191) NULL,
  `error_code` VARCHAR(100) NULL,
  `error_message` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  `reviewed_by` INTEGER NULL,

  INDEX `audit_write_failures_reviewed_at_created_at_idx` (`reviewed_at`, `created_at`),
  INDEX `audit_write_failures_created_at_idx` (`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
