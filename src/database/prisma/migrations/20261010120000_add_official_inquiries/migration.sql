CREATE TABLE `official_inquiries` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reference_number` VARCHAR(60) NOT NULL,
  `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(255) NULL,
  `inquiry_type` VARCHAR(40) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `official_inquiries_reference_number_key` (`reference_number`),
  INDEX `official_inquiries_status_created_at_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
