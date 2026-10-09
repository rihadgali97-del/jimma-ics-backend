CREATE TABLE `announcements` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(240) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `publish_date` DATE NOT NULL,
  `hijri_date` VARCHAR(100) NOT NULL DEFAULT '',
  `author` VARCHAR(200) NOT NULL,
  `summary` TEXT NOT NULL,
  `content` LONGTEXT NOT NULL,
  `is_pinned` BOOLEAN NOT NULL DEFAULT false,
  `is_urgent` BOOLEAN NOT NULL DEFAULT false,
  `priority` VARCHAR(20) NOT NULL DEFAULT 'Normal',
  `district` VARCHAR(150) NULL,
  `target_audience` VARCHAR(200) NULL,
  `read_time` VARCHAR(30) NOT NULL DEFAULT '1 min read',
  `is_published` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `announcements_is_published_is_pinned_publish_date_idx` (`is_published`, `is_pinned`, `publish_date`),
  INDEX `announcements_category_publish_date_idx` (`category`, `publish_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
