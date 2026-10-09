ALTER TABLE `mosques`
    ADD COLUMN `photo_url` VARCHAR(1000) NULL,
    ADD COLUMN `photo_public_id` VARCHAR(255) NULL;

ALTER TABLE `madrasas`
    ADD COLUMN `photo_url` VARCHAR(1000) NULL,
    ADD COLUMN `photo_public_id` VARCHAR(255) NULL;
