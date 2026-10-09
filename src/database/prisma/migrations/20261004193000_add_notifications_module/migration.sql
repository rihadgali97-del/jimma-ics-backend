CREATE TABLE `event_notification_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NULL,
    `normalized_email` VARCHAR(255) NULL,
    `name` VARCHAR(180) NOT NULL DEFAULT 'Community Member',
    `manage_token` VARCHAR(64) NOT NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `email_verification_token` VARCHAR(64) NULL,
    `email_verification_expires_at` DATETIME(3) NULL,
    `enable_email` BOOLEAN NOT NULL DEFAULT false,
    `enable_browser` BOOLEAN NOT NULL DEFAULT false,
    `enable_announcements` BOOLEAN NOT NULL DEFAULT false,
    `categories` JSON NOT NULL,
    `districts` JSON NOT NULL,
    `reminder_timing` VARCHAR(30) NOT NULL DEFAULT '24h_before',
    `specific_event_ids` JSON NOT NULL,
    `subscribed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `event_notification_subscriptions_normalized_email_key`(`normalized_email`),
    UNIQUE INDEX `event_notification_subscriptions_manage_token_key`(`manage_token`),
    UNIQUE INDEX `event_notification_subscriptions_email_verification_token_key`(`email_verification_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `web_push_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NOT NULL,
    `endpoint` TEXT NOT NULL,
    `endpoint_hash` VARCHAR(64) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `web_push_subscriptions_endpoint_hash_key`(`endpoint_hash`),
    INDEX `web_push_subscriptions_subscription_id_idx`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_id` INTEGER NULL,
    `push_subscription_id` INTEGER NULL,
    `channel` ENUM('EMAIL', 'WEB_PUSH', 'TELEGRAM') NOT NULL,
    `notification_type` VARCHAR(40) NOT NULL,
    `reference_type` VARCHAR(40) NULL,
    `reference_id` INTEGER NULL,
    `recipient` VARCHAR(2048) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `scheduled_at` DATETIME(3) NOT NULL,
    `sent_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `deduplication_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_logs_deduplication_key_key`(`deduplication_key`),
    INDEX `notification_logs_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `notification_logs_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_logs`
    ADD CONSTRAINT `notification_logs_subscription_id_fkey`
    FOREIGN KEY (`subscription_id`) REFERENCES `event_notification_subscriptions`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `web_push_subscriptions`
    ADD CONSTRAINT `web_push_subscriptions_subscription_id_fkey`
    FOREIGN KEY (`subscription_id`) REFERENCES `event_notification_subscriptions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notification_logs`
    ADD CONSTRAINT `notification_logs_push_subscription_id_fkey`
    FOREIGN KEY (`push_subscription_id`) REFERENCES `web_push_subscriptions`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
