-- CreateTable
CREATE TABLE `waqf_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woreda_id` INTEGER NOT NULL,
    `type` ENUM('LAND', 'COMMERCIAL_RENTAL', 'AGRICULTURAL', 'CEMETERY') NOT NULL,
    `status` ENUM('ACTIVE', 'UNDER_MAINTENANCE', 'DISPUTED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `location_note` VARCHAR(191) NULL,
    `monthly_income` DOUBLE NULL,
    `tenant_name` VARCHAR(191) NULL,
    `tenant_contact` VARCHAR(191) NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `waqf_assets_woreda_id_idx`(`woreda_id`),
    INDEX `waqf_assets_type_idx`(`type`),
    INDEX `waqf_assets_is_published_idx`(`is_published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('BALANCE_SHEET', 'ZAKAT_AUDIT', 'EXPENDITURE') NOT NULL,
    `period_label` VARCHAR(191) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_reports_type_idx`(`type`),
    INDEX `financial_reports_period_start_idx`(`period_start`),
    INDEX `financial_reports_is_published_idx`(`is_published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_report_line_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `financial_report_id` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `financial_report_line_items_financial_report_id_idx`(`financial_report_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `waqf_assets` ADD CONSTRAINT `waqf_assets_woreda_id_fkey` FOREIGN KEY (`woreda_id`) REFERENCES `woredas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_report_line_items` ADD CONSTRAINT `financial_report_line_items_financial_report_id_fkey` FOREIGN KEY (`financial_report_id`) REFERENCES `financial_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
