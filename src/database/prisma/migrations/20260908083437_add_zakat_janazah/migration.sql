-- CreateTable
CREATE TABLE `mosques` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woreda_id` INTEGER NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `capacity` INTEGER NULL,
    `has_wudu_facility` BOOLEAN NOT NULL DEFAULT false,
    `has_boarding` BOOLEAN NOT NULL DEFAULT false,
    `imam_name` VARCHAR(191) NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `mosques_woreda_id_idx`(`woreda_id`),
    INDEX `mosques_is_published_idx`(`is_published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mosque_prayer_times` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mosque_id` INTEGER NOT NULL,
    `prayer_name` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mosque_prayer_times_mosque_id_prayer_name_key`(`mosque_id`, `prayer_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `madrasas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woreda_id` INTEGER NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `capacity` INTEGER NULL,
    `has_boarding` BOOLEAN NOT NULL DEFAULT false,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `madrasas_woreda_id_idx`(`woreda_id`),
    INDEX `madrasas_is_published_idx`(`is_published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reference_sequences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_code` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `last_number` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `reference_sequences_service_code_year_key`(`service_code`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zakat_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference_number` VARCHAR(191) NOT NULL,
    `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `woreda_id` INTEGER NOT NULL,
    `applicant_full_name` VARCHAR(191) NOT NULL,
    `applicant_phone` VARCHAR(191) NOT NULL,
    `household_size` INTEGER NULL,
    `eligibility_notes` TEXT NULL,
    `assigned_officer_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `zakat_applications_reference_number_key`(`reference_number`),
    INDEX `zakat_applications_woreda_id_idx`(`woreda_id`),
    INDEX `zakat_applications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nisab_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gold_price_per_gram` DOUBLE NOT NULL,
    `silver_price_per_gram` DOUBLE NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `nisab_rates_effective_date_idx`(`effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `janazah_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference_number` VARCHAR(191) NOT NULL,
    `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `woreda_id` INTEGER NOT NULL,
    `deceased_name` VARCHAR(191) NOT NULL,
    `contact_name` VARCHAR(191) NOT NULL,
    `contact_phone` VARCHAR(191) NOT NULL,
    `needs_ghusl` BOOLEAN NOT NULL DEFAULT false,
    `needs_transport` BOOLEAN NOT NULL DEFAULT false,
    `needs_cemetery_plot` BOOLEAN NOT NULL DEFAULT false,
    `location_note` VARCHAR(191) NULL,
    `assigned_officer_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `janazah_requests_reference_number_key`(`reference_number`),
    INDEX `janazah_requests_woreda_id_idx`(`woreda_id`),
    INDEX `janazah_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cemetery_plots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woreda_id` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cemetery_plots_code_key`(`code`),
    INDEX `cemetery_plots_woreda_id_idx`(`woreda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mosques` ADD CONSTRAINT `mosques_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mosque_prayer_times` ADD CONSTRAINT `mosque_prayer_times_mosque_id_fkey` FOREIGN KEY (`mosque_id`) REFERENCES `mosques`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `madrasas` ADD CONSTRAINT `madrasas_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_applications` ADD CONSTRAINT `zakat_applications_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_applications` ADD CONSTRAINT `zakat_applications_assigned_officer_id_fkey` FOREIGN KEY (`assigned_officer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `janazah_requests` ADD CONSTRAINT `janazah_requests_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `janazah_requests` ADD CONSTRAINT `janazah_requests_assigned_officer_id_fkey` FOREIGN KEY (`assigned_officer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cemetery_plots` ADD CONSTRAINT `cemetery_plots_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
