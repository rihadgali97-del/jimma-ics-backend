-- CreateTable
CREATE TABLE `council_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(240) NOT NULL,
    `arabic_title` VARCHAR(240) NULL,
    `category` VARCHAR(80) NOT NULL,
    `date` DATE NOT NULL,
    `hijri_date` VARCHAR(100) NOT NULL,
    `time` VARCHAR(100) NOT NULL,
    `location` VARCHAR(240) NOT NULL,
    `venue_details` VARCHAR(500) NULL,
    `district` VARCHAR(150) NOT NULL,
    `organizer` VARCHAR(200) NOT NULL,
    `speaker` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `max_capacity` INTEGER NOT NULL,
    `registered_seats` INTEGER NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `image` VARCHAR(1000) NOT NULL,
    `registration_open` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Upcoming',
    `format` VARCHAR(30) NULL,
    `entry_fee` VARCHAR(100) NULL,
    `target_audience` VARCHAR(500) NULL,
    `livestream_url` VARCHAR(1000) NULL,
    `contact_phone` VARCHAR(30) NULL,
    `contact_email` VARCHAR(255) NULL,
    `schedule` JSON NULL,
    `speakers_list` JSON NULL,
    `tags` JSON NULL,
    `materials` JSON NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `council_events_date_status_idx`(`date`, `status`),
    INDEX `council_events_is_published_date_idx`(`is_published`, `date`),
    INDEX `council_events_category_district_idx`(`category`, `district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_registrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_id` INTEGER NOT NULL,
    `full_name` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NULL,
    `district` VARCHAR(150) NOT NULL,
    `organization_or_madrasa` VARCHAR(200) NULL,
    `attendees_count` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `pass_number` VARCHAR(40) NOT NULL,
    `status` ENUM('CONFIRMED', 'CHECKED_IN', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checked_in_at` DATETIME(3) NULL,

    UNIQUE INDEX `event_registrations_pass_number_key`(`pass_number`),
    INDEX `event_registrations_event_id_status_created_at_idx`(`event_id`, `status`, `created_at`),
    INDEX `event_registrations_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event_registrations` ADD CONSTRAINT `event_registrations_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `council_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
