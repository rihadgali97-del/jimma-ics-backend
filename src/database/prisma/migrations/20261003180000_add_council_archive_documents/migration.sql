CREATE TABLE `council_archive_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL DEFAULT 'General',
    `description` TEXT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `cloudinary_public_id` VARCHAR(255) NOT NULL,
    `cloudinary_version` INTEGER NOT NULL,
    `uploaded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `council_archive_documents_created_at_idx`(`created_at`),
    UNIQUE INDEX `council_archive_documents_cloudinary_public_id_key`(`cloudinary_public_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
