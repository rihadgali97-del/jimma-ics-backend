-- CreateTable
CREATE TABLE `civic_service_settings` (
    `service_key` VARCHAR(64) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_by_id` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`service_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed Janazah public intake as enabled (admin can turn off from dashboard)
INSERT INTO `civic_service_settings` (`service_key`, `is_enabled`, `updated_at`, `created_at`)
VALUES ('janazah', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
