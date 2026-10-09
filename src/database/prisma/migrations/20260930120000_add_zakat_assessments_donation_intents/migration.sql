CREATE TABLE `zakat_assessments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `assessed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `summary` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `zakat_assessments_user_id_assessed_at_idx` (`user_id`, `assessed_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `zakat_assessments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `donation_intents` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reference` VARCHAR(32) NOT NULL,
  `donor_name` VARCHAR(150) NULL,
  `donor_phone` VARCHAR(30) NOT NULL,
  `donor_email` VARCHAR(255) NULL,
  `anonymous` BOOLEAN NOT NULL DEFAULT false,
  `amount_etb` DECIMAL(14, 2) NOT NULL,
  `fund_name` VARCHAR(120) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `payment_method` VARCHAR(30) NOT NULL,
  `status` ENUM('PENDING_PAYMENT', 'PAYMENT_REPORTED', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `donation_intents_reference_key` (`reference`),
  INDEX `donation_intents_donor_phone_created_at_idx` (`donor_phone`, `created_at`),
  INDEX `donation_intents_status_created_at_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
