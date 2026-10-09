CREATE TABLE `council_document_share_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `council_document_share_links_token_hash_key`(`token_hash`),
    INDEX `council_document_share_links_document_id_expires_at_idx`(`document_id`, `expires_at`),
    INDEX `council_document_share_links_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `council_document_share_links_document_id_fkey`
      FOREIGN KEY (`document_id`) REFERENCES `council_archive_documents`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
